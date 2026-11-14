-- Autoridade privada; somente as relações necessárias são publicadas na Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

create table public.tenants (
 id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check (length(name) between 1 and 160), status text not null default 'active' check (status in ('active','suspended')),
 created_at timestamptz not null default now()
);
create table public.units (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 name text not null check (length(name) between 1 and 160), active boolean not null default true,
 unique(tenant_id,id)
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (length(display_name) <= 160)
);
create table private.role_permissions (
 role text not null, permission text not null, primary key(role,permission)
);
insert into private.role_permissions
select r,p from unnest(array['clinic_admin','manager','reception','professional','finance','auditor']) r
cross join unnest(array['unit.read']) p;
insert into private.role_permissions values
 ('clinic_admin','members.manage'),('clinic_admin','audit.read'),('clinic_admin','storage.read'),('clinic_admin','storage.write'),
 ('manager','storage.read'),('manager','storage.write'),('reception','storage.read'),('finance','storage.read'),('auditor','audit.read');
create table public.tenant_memberships (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('clinic_admin','manager','reception','professional','finance','auditor')),
 status text not null default 'active' check(status in ('active','revoked')),
 unique(tenant_id,user_id), unique(tenant_id,id)
);
create index memberships_user on public.tenant_memberships(user_id,tenant_id);
create table public.membership_units (
 tenant_id uuid not null, membership_id uuid not null, unit_id uuid not null,
 primary key(tenant_id,membership_id,unit_id),
 foreign key(tenant_id,membership_id) references public.tenant_memberships(tenant_id,id) on delete cascade,
 foreign key(tenant_id,unit_id) references public.units(tenant_id,id)
);
create table public.tenant_entitlements (
 tenant_id uuid not null references public.tenants(id), module_key text not null,
 enabled boolean not null default true, valid_from timestamptz not null default now(), valid_until timestamptz,
 primary key(tenant_id,module_key), check(valid_until is null or valid_until > valid_from)
);
create table public.tenant_invitations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null,
 email text not null check(email = lower(email) and email like '%@%'),
 role text not null check(role in ('clinic_admin','manager','reception','professional','finance','auditor')),
 expires_at timestamptz not null default (now()+interval '7 days'), revoked_at timestamptz,
 accepted_by uuid references auth.users(id), accepted_at timestamptz,
 foreign key(tenant_id,unit_id) references public.units(tenant_id,id), unique(tenant_id,id)
);
create table private.platform_admin_emails (email text primary key check(email=lower(email)));
insert into private.platform_admin_emails values ('grupozettaoficial@gmail.com');
create table private.platform_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('superadmin','implementation')), active boolean not null default true
);
create table public.audit_logs (
 id bigint generated always as identity primary key, tenant_id uuid references public.tenants(id),
 actor_id uuid, action text not null, entity text not null, entity_id text not null,
 created_at timestamptz not null default now()
);
create index audit_tenant on public.audit_logs(tenant_id,created_at);

create function private.is_allowed(t uuid, u uuid, p text, module text default 'core') returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
 select 1 from public.tenant_memberships m
 join public.tenants tnt on tnt.id=m.tenant_id and tnt.status='active'
 join private.role_permissions rp on rp.role=m.role and rp.permission=p
 join public.tenant_entitlements e on e.tenant_id=m.tenant_id and e.module_key=module and e.enabled
   and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
 where m.tenant_id=t and m.user_id=auth.uid() and m.status='active'
 and (u is null or exists(select 1 from public.membership_units mu join public.units un on un.tenant_id=mu.tenant_id and un.id=mu.unit_id
 where mu.tenant_id=t and mu.membership_id=m.id and mu.unit_id=u and un.active)))
$$;
create function private.is_member(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_allowed(t,null,'unit.read')
$$;
create function private.platform_role() returns text language sql stable security definer set search_path='' as $$
 select role from private.platform_memberships where user_id=auth.uid() and active
$$;
create function public.platform_context() returns text language sql stable security invoker set search_path='' as $$
 select private.platform_role()
$$;
create function public.check_access(tenant uuid, unit uuid, permission text, module text default 'core') returns boolean
language sql stable security invoker set search_path='' as $$ select private.is_allowed(tenant,unit,permission,module) $$;
create function public.platform_tenants() returns table(id uuid,name text,slug text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if private.platform_role() is distinct from 'superadmin' then raise exception 'Acesso negado' using errcode='42501'; end if;
 return query select t.id,t.name,t.slug,t.status from public.tenants t;
end $$;

create function private.on_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id) values(new.id) on conflict do nothing;
 -- Metadados enviados pelo usuário nunca concedem autoridade. Exige e-mail confirmado.
 if new.email_confirmed_at is not null and exists(select 1 from private.platform_admin_emails a where a.email=lower(new.email)) then
  insert into private.platform_memberships(user_id,role) values(new.id,'superadmin') on conflict(user_id) do update set role='superadmin',active=true;
  insert into public.audit_logs(actor_id,action,entity,entity_id) values(new.id,'bootstrap','platform_memberships',new.id::text);
 end if;
 return new;
end $$;
create trigger zetta_auth_user after insert or update of email,email_confirmed_at on auth.users for each row execute function private.on_auth_user();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 r := case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_logs(tenant_id,actor_id,action,entity,entity_id)
 values((case when TG_TABLE_NAME='tenants' then r->>'id' else r->>'tenant_id' end)::uuid,auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(r->>'id',r->>'membership_id',r->>'user_id',r->>'module_key',r->>'email'));
 return coalesce(new,old);
end $$;
do $$ declare tab text; begin
 foreach tab in array array['tenants','units','tenant_memberships','membership_units','tenant_invitations','tenant_entitlements'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',tab);
 end loop;
end $$;
create trigger audit_platform after insert or update or delete on private.platform_memberships for each row execute function private.audit_change();

-- Somente rotinas autorizadas alteram papéis, vínculos, convites e estado.
create function public.invite_member(tenant uuid, unit uuid, email text, clinic_role text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.is_allowed(tenant,unit,'members.manage') or unit is null then raise exception 'Acesso negado' using errcode='42501'; end if;
 insert into public.tenant_invitations(tenant_id,unit_id,email,role) values(tenant,unit,lower(trim(email)),clinic_role) returning id into result;
 return result;
end $$;
create function public.accept_invitation(invitation uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare inv public.tenant_invitations; mid uuid;
begin
 select * into inv from public.tenant_invitations where id=invitation for update;
 if not found or auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=inv.email)
 then raise exception 'Convite indisponível' using errcode='42501'; end if;
 if inv.accepted_by=auth.uid() then
   select id into mid from public.tenant_memberships where tenant_id=inv.tenant_id and user_id=auth.uid(); return mid;
 end if;
 if inv.revoked_at is not null or inv.expires_at<=now() or inv.accepted_by is not null
 or not exists(select 1 from public.units where tenant_id=inv.tenant_id and id=inv.unit_id and active)
 or not exists(select 1 from public.tenants where id=inv.tenant_id and status='active')
 then raise exception 'Convite indisponível' using errcode='42501'; end if;
 -- Vínculo existente (inclusive revogado) exige revisão administrativa; convite não o reativa.
 insert into public.tenant_memberships(tenant_id,user_id,role) values(inv.tenant_id,auth.uid(),inv.role) returning id into mid;
 insert into public.membership_units values(inv.tenant_id,mid,inv.unit_id);
 update public.tenant_invitations set accepted_by=auth.uid(),accepted_at=now() where id=invitation;
 return mid;
end $$;
create function public.revoke_membership(tenant uuid, membership uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target public.tenant_memberships;
begin
 -- Serializa com mudanças administrativas concorrentes.
 select * into target from public.tenant_memberships where tenant_id=tenant and id=membership for update;
 if not found or target.user_id=auth.uid() or not private.is_allowed(tenant,null,'members.manage')
 or exists(select 1 from public.membership_units mu where mu.tenant_id=tenant and mu.membership_id=membership and not private.is_allowed(tenant,mu.unit_id,'members.manage'))
 then raise exception 'Acesso negado' using errcode='42501'; end if;
 update public.tenant_memberships set status='revoked' where tenant_id=tenant and id=membership;
 update public.tenant_invitations set revoked_at=now() where tenant_id=tenant and accepted_by=target.user_id;
end $$;
create function public.revoke_invitation(tenant uuid, invitation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 select unit_id into u from public.tenant_invitations where tenant_id=tenant and id=invitation for update;
 if u is null or not private.is_allowed(tenant,u,'members.manage') then raise exception 'Acesso negado' using errcode='42501'; end if;
 update public.tenant_invitations set revoked_at=now() where tenant_id=tenant and id=invitation;
end $$;

-- RLS sem recursão: os helpers privados consultam autoridade sem delegar ao cliente.
do $$ declare tab text; begin
 foreach tab in array array['tenants','units','profiles','tenant_memberships','membership_units','tenant_invitations','tenant_entitlements','audit_logs'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from anon, authenticated',tab);
 end loop;
end $$;
create policy tenants_read on public.tenants for select to authenticated using(private.is_member(id));
create policy units_read on public.units for select to authenticated using(private.is_allowed(tenant_id,id,'unit.read'));
create policy units_update on public.units for update to authenticated using(private.is_allowed(tenant_id,id,'members.manage')) with check(private.is_allowed(tenant_id,id,'members.manage'));
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy members_read on public.tenant_memberships for select to authenticated using(private.is_member(tenant_id) and (user_id=auth.uid() or private.is_allowed(tenant_id,null,'members.manage')));
create policy member_units_read on public.membership_units for select to authenticated using(private.is_allowed(tenant_id,unit_id,'unit.read'));
create policy invites_read on public.tenant_invitations for select to authenticated using(private.is_allowed(tenant_id,unit_id,'members.manage'));
create policy entitlements_read on public.tenant_entitlements for select to authenticated using(private.is_member(tenant_id));
create policy audit_read on public.audit_logs for select to authenticated using(private.is_allowed(tenant_id,null,'audit.read'));
grant select on public.tenants,public.units,public.profiles,public.tenant_memberships,public.membership_units,public.tenant_invitations,public.tenant_entitlements,public.audit_logs to authenticated;
grant update(name) on public.units to authenticated;
grant update(display_name) on public.profiles to authenticated;
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_allowed(uuid,uuid,text,text),private.is_member(uuid),private.platform_role() to authenticated;
revoke all on function public.check_access(uuid,uuid,text,text),public.platform_context(),public.platform_tenants(),public.invite_member(uuid,uuid,text,text),public.accept_invitation(uuid),public.revoke_membership(uuid,uuid),public.revoke_invitation(uuid,uuid) from public,anon;
grant execute on function public.check_access(uuid,uuid,text,text),public.platform_context(),public.platform_tenants(),public.invite_member(uuid,uuid,text,text),public.accept_invitation(uuid),public.revoke_membership(uuid,uuid),public.revoke_invitation(uuid,uuid) to authenticated;

-- Objetos: foundation-test/<tenant UUID>/<unit UUID>/<arquivo>. Bucket sempre privado.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('foundation-test','foundation-test',false,1048576,array['text/plain']) on conflict(id) do nothing;
create function private.object_allowed(object_name text, permission text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.units u where u.tenant_id::text=split_part(object_name,'/',1) and u.id::text=split_part(object_name,'/',2)
 and split_part(object_name,'/',3)<>'' and private.is_allowed(u.tenant_id,u.id,permission))
$$;
revoke all on function private.object_allowed(text,text) from public,anon;
grant execute on function private.object_allowed(text,text) to authenticated;
create policy foundation_object_read on storage.objects for select to authenticated using(bucket_id='foundation-test' and private.object_allowed(name,'storage.read'));
create policy foundation_object_insert on storage.objects for insert to authenticated with check(bucket_id='foundation-test' and private.object_allowed(name,'storage.write'));
create policy foundation_object_update on storage.objects for update to authenticated using(bucket_id='foundation-test' and private.object_allowed(name,'storage.write')) with check(bucket_id='foundation-test' and private.object_allowed(name,'storage.write'));
create policy foundation_object_delete on storage.objects for delete to authenticated using(bucket_id='foundation-test' and private.object_allowed(name,'storage.write'));
