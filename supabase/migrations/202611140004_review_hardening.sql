-- Revisão Prompt 01: correções aditivas de autoridade, histórico e ciclo de convite.
-- UUIDs históricos não possuem FK: exclusão administrativa não deve apagar nem bloquear auditoria.
alter table public.audit_logs drop constraint audit_logs_tenant_id_fkey;
alter table public.audit_logs drop constraint audit_logs_tenant_id_unit_id_fkey;
-- Snapshot do escopo de equipe; eventos antigos/sem escopo exigem acesso a todas as unidades.
alter table public.audit_logs add column scope_unit_ids uuid[] not null default '{}';
create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; t uuid; u uuid; scopes uuid[] := '{}';
begin
 r := case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 t := (case when TG_TABLE_NAME='tenants' then r->>'id' else r->>'tenant_id' end)::uuid;
 u := (case when TG_TABLE_NAME='units' then r->>'id' else r->>'unit_id' end)::uuid;
 if TG_TABLE_NAME='tenant_memberships' then
   select coalesce(array_agg(mu.unit_id),'{}'::uuid[]) into scopes from public.membership_units mu
   where mu.tenant_id=t and mu.membership_id=(r->>'id')::uuid;
 end if;
 insert into public.audit_logs(tenant_id,unit_id,scope_unit_ids,actor_id,action,entity,entity_id)
 values(t,u,scopes,auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(r->>'id',r->>'membership_id',r->>'user_id',r->>'module_key',r->>'email'));
 return coalesce(new,old);
end $$;
create function private.audit_allowed(t uuid,u uuid,entity text,scopes uuid[]) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_allowed(t,u,'audit.read') and
 (entity<>'tenant_memberships' or u is not null or
 case when cardinality(scopes)>0 then
   not exists(select 1 from unnest(scopes) s where not private.is_allowed(t,s,'audit.read'))
 else
   not exists(select 1 from public.units un where un.tenant_id=t and not private.is_allowed(t,un.id,'audit.read'))
 end)
$$;
revoke all on function private.audit_allowed(uuid,uuid,text,uuid[]) from public,anon;
grant execute on function private.audit_allowed(uuid,uuid,text,uuid[]) to authenticated;
drop policy audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
 using(private.audit_allowed(tenant_id,unit_id,entity,scope_unit_ids));

create or replace function private.is_allowed(t uuid, u uuid, p text, module text default 'core') returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
 select 1 from public.tenant_memberships m
 join public.tenants tnt on tnt.id=m.tenant_id and tnt.status='active'
 join private.role_permissions rp on rp.role=m.role and rp.permission=p
 join public.tenant_entitlements e on e.tenant_id=m.tenant_id and e.module_key=module and e.enabled
   and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
 where m.tenant_id=t and m.user_id=auth.uid() and m.status='active'
 and exists(select 1 from public.membership_units mu join public.units un on un.tenant_id=mu.tenant_id and un.id=mu.unit_id
 where mu.tenant_id=t and mu.membership_id=m.id and (u is null or mu.unit_id=u) and un.active))
$$;

create or replace function public.accept_invitation(invitation uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.tenant_invitations; mid uuid;
begin
 select * into inv from public.tenant_invitations where id=invitation for update;
 if not found or auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=inv.email)
 then raise exception 'Convite indisponível' using errcode='42501'; end if;
 if inv.revoked_at is not null or (inv.accepted_at is null and inv.expires_at<=now())
 or not exists(select 1 from public.units where tenant_id=inv.tenant_id and id=inv.unit_id and active)
 or not exists(select 1 from public.tenants where id=inv.tenant_id and status='active')
 or not exists(select 1 from public.tenant_entitlements where tenant_id=inv.tenant_id and module_key='core' and enabled and valid_from<=now() and (valid_until is null or valid_until>now()))
 -- A autoridade que emitiu o convite precisa continuar vigente no mesmo escopo.
 or not exists(select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id
 join private.role_permissions rp on rp.role=m.role and rp.permission='members.manage'
 where m.tenant_id=inv.tenant_id and m.user_id=inv.invited_by and m.status='active' and mu.unit_id=inv.unit_id)
 then raise exception 'Convite indisponível' using errcode='42501'; end if;
 -- Convites distintos para o mesmo usuário também precisam serializar o vínculo único.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(inv.tenant_id::text || ':' || auth.uid()::text,0));
 if inv.accepted_by=auth.uid() then
   select m.id into mid from public.tenant_memberships m
   join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id and mu.unit_id=inv.unit_id
   where m.tenant_id=inv.tenant_id and m.user_id=auth.uid() and m.status='active';
   if mid is null then raise exception 'Convite indisponível' using errcode='42501'; end if;
   return mid;
 end if;
 if inv.accepted_at is not null or exists(select 1 from public.tenant_memberships where tenant_id=inv.tenant_id and user_id=auth.uid())
 then raise exception 'Convite indisponível' using errcode='42501'; end if;
 begin
 insert into public.tenant_memberships(tenant_id,user_id,role) values(inv.tenant_id,auth.uid(),inv.role) returning id into mid;
 exception when unique_violation then raise exception 'Convite indisponível' using errcode='42501';
 end;
 insert into public.membership_units values(inv.tenant_id,mid,inv.unit_id);
 update public.tenant_invitations set accepted_by=auth.uid(),accepted_at=now() where id=invitation;
 return mid;
end $$;

create or replace function public.invite_member(tenant uuid, unit uuid, email text, clinic_role text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.is_allowed(tenant,unit,'members.manage') or unit is null then raise exception 'Acesso negado' using errcode='42501'; end if;
 if email is null or lower(trim(invite_member.email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or exists(select 1 from auth.users u join public.tenant_memberships m on m.user_id=u.id
 where m.tenant_id=tenant and lower(u.email)=lower(trim(invite_member.email)))
 then raise exception 'Convite indisponível' using errcode='42501'; end if;
 insert into public.tenant_invitations(tenant_id,unit_id,email,role) values(tenant,unit,lower(trim(invite_member.email)),clinic_role) returning id into result;
 return result;
end $$;

create or replace function private.on_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id) values(new.id) on conflict do nothing;
 -- Metadados enviados pelo usuário nunca concedem autoridade. Exige e-mail confirmado.
 if new.email_confirmed_at is not null and exists(select 1 from private.platform_admin_emails a where a.email=lower(new.email)) then
  insert into private.platform_memberships(user_id,role) values(new.id,'superadmin') on conflict(user_id) do nothing;
 end if;
 return new;
end $$;

alter table public.tenant_invitations add constraint invitation_email_format
 check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') not valid;
-- NOT VALID preserva histórico legado; novas escritas são validadas.
