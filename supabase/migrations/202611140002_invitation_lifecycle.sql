-- Manter histórico sem impedir exclusão da identidade no Auth.
alter table public.tenant_invitations drop constraint tenant_invitations_accepted_by_fkey;
alter table public.tenant_invitations add constraint tenant_invitations_accepted_by_fkey foreign key(accepted_by) references auth.users(id) on delete set null;
alter table public.tenant_invitations add column invited_by uuid default auth.uid() references auth.users(id) on delete set null;
create index invitations_tenant on public.tenant_invitations(tenant_id,unit_id);
create index invitations_issuer on public.tenant_invitations(invited_by);
create index membership_units_unit on public.membership_units(tenant_id,unit_id);
create or replace function public.accept_invitation(invitation uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.tenant_invitations; mid uuid;
begin
 select * into inv from public.tenant_invitations where id=invitation for update;
 if not found or auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=inv.email)
 then raise exception 'Convite indisponível' using errcode='42501'; end if;
 if inv.accepted_by=auth.uid() then
   select id into mid from public.tenant_memberships where tenant_id=inv.tenant_id and user_id=auth.uid(); return mid;
 end if;
 if inv.revoked_at is not null or inv.expires_at<=now() or inv.accepted_at is not null
 or not exists(select 1 from public.units where tenant_id=inv.tenant_id and id=inv.unit_id and active)
 or not exists(select 1 from public.tenants where id=inv.tenant_id and status='active')
 or not exists(select 1 from public.tenant_entitlements where tenant_id=inv.tenant_id and module_key='core' and enabled and valid_from<=now() and (valid_until is null or valid_until>now()))
 -- A autoridade que emitiu o convite precisa continuar vigente no mesmo escopo.
 or not exists(select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id
 join private.role_permissions rp on rp.role=m.role and rp.permission='members.manage'
 where m.tenant_id=inv.tenant_id and m.user_id=inv.invited_by and m.status='active' and mu.unit_id=inv.unit_id)
 then raise exception 'Convite indisponível' using errcode='42501'; end if;
 insert into public.tenant_memberships(tenant_id,user_id,role) values(inv.tenant_id,auth.uid(),inv.role) returning id into mid;
 insert into public.membership_units values(inv.tenant_id,mid,inv.unit_id);
 update public.tenant_invitations set accepted_by=auth.uid(),accepted_at=now() where id=invitation;
 return mid;
end $$;
create or replace function public.revoke_membership(tenant uuid, membership uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target public.tenant_memberships;
begin
 select * into target from public.tenant_memberships where tenant_id=tenant and id=membership for update;
 if not found or target.user_id=auth.uid() or not private.is_allowed(tenant,null,'members.manage')
 or exists(select 1 from public.membership_units mu where mu.tenant_id=tenant and mu.membership_id=membership and not private.is_allowed(tenant,mu.unit_id,'members.manage'))
 then raise exception 'Acesso negado' using errcode='42501'; end if;
 update public.tenant_memberships set status='revoked' where tenant_id=tenant and id=membership;
 update public.tenant_invitations set revoked_at=now() where tenant_id=tenant and (accepted_by=target.user_id or invited_by=target.user_id);
end $$;
