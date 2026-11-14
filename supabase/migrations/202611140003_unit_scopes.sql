-- Metadados de equipe e auditoria também respeitam unidades atribuídas.
create function private.can_manage_membership(t uuid, membership uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_allowed(t,null,'members.manage')
 and exists(select 1 from public.tenant_memberships m where m.tenant_id=t and m.id=membership)
 and not exists(select 1 from public.membership_units mu where mu.tenant_id=t and mu.membership_id=membership
 and not private.is_allowed(t,mu.unit_id,'members.manage'))
$$;
revoke all on function private.can_manage_membership(uuid,uuid) from public,anon;
grant execute on function private.can_manage_membership(uuid,uuid) to authenticated;
drop policy members_read on public.tenant_memberships;
create policy members_read on public.tenant_memberships for select to authenticated
 using(private.is_member(tenant_id) and (user_id=auth.uid() or private.can_manage_membership(tenant_id,id)));
alter table public.audit_logs add column unit_id uuid;
alter table public.audit_logs add foreign key(tenant_id,unit_id) references public.units(tenant_id,id);
create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; t uuid; u uuid;
begin
 r := case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 t := (case when TG_TABLE_NAME='tenants' then r->>'id' else r->>'tenant_id' end)::uuid;
 u := (case when TG_TABLE_NAME='units' then r->>'id' else r->>'unit_id' end)::uuid;
 insert into public.audit_logs(tenant_id,unit_id,actor_id,action,entity,entity_id)
 values(t,u,auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(r->>'id',r->>'membership_id',r->>'user_id',r->>'module_key',r->>'email'));
 return coalesce(new,old);
end $$;
drop policy audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated using(private.is_allowed(tenant_id,unit_id,'audit.read'));
-- Os grants existem no Supabase real e no bootstrap; declarar o contrato nesta migration.
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
