-- Prompt 02: catálogo versionado e console; nenhuma credencial externa no banco público.
create table public.module_catalog (
 key text primary key, name text not null, version integer not null check(version>0),
 description text not null, route text not null, permission text not null unique,
 dependencies text[] not null default '{}', configurable boolean not null default true
);
insert into public.module_catalog values
 ('core','Núcleo',1,'Identidade, equipe e unidades','/','unit.read','{}',false),
 ('agenda','Agenda',1,'Autorização de teste; agenda operacional nas próximas etapas','/modulos/agenda','agenda.test',array['core'],true),
 ('packages','Pacotes',1,'Autorização de teste; pacotes operacionais nas próximas etapas','/modulos/packages','packages.test',array['agenda'],true);
create table public.plans (
 key text primary key, name text not null, version integer not null default 1,
 unit_limit integer not null check(unit_limit between 1 and 1000), monthly_cents integer not null check(monthly_cents>=0)
);
insert into public.plans values ('essential','Essencial',1,2,19900),('complete','Completo',1,5,39900);
create table public.plan_modules (
 plan_key text not null references public.plans(key), module_key text not null references public.module_catalog(key),
 primary key(plan_key,module_key)
);
insert into public.plan_modules values ('essential','core'),('essential','agenda'),('complete','core'),('complete','agenda'),('complete','packages');
create table public.tenant_subscriptions (
 tenant_id uuid primary key references public.tenants(id), plan_key text not null references public.plans(key),
 valid_from timestamptz not null default now(), valid_until timestamptz,
 state text not null default 'trial' check(state in ('trial','active','grace','cancelled')),
 unit_limit_override integer check(unit_limit_override between 1 and 1000),
 check(valid_until is null or valid_until>valid_from)
);
create table public.tenant_configuration (
 tenant_id uuid primary key references public.tenants(id), brand text not null check(length(brand) between 1 and 160),
 timezone text not null default 'America/Sao_Paulo', responsible_name text not null,
 onboarding_state text not null default 'configuration' check(onboarding_state in ('configuration','validation','pilot','active')),
 export_until timestamptz, suspended_at timestamptz
);
create table public.tenant_connections (
 tenant_id uuid primary key references public.tenants(id), credential_state text not null default 'pending' check(credential_state in ('pending','server_reference')),
 test_state text not null default 'not_tested' check(test_state in ('not_tested','blocked')),
 capability_state text not null default 'CAPABILITY_NOT_VERIFIED' check(capability_state='CAPABILITY_NOT_VERIFIED'),
 last_test_at timestamptz, evidence text not null default 'Sem credencial FLW e sem teste autenticado. Operação manual.',
 icon_state text not null default 'pending' check(icon_state in ('pending','manual_configuration','awaiting_validation')),
 icon_account_label text not null default '', icon_installer uuid references auth.users(id) on delete set null,
 icon_updated_at timestamptz, return_url text not null default '' check(return_url='' or return_url ~ '^https://[^[:space:]]+$'),
 opening_mode text not null default 'external' check(opening_mode='external')
);
alter table public.tenant_entitlements add column source text not null default 'plan' check(source in ('plan','override'));
alter table public.tenant_entitlements add column reason text not null default '';
alter table public.tenant_entitlements add column configured boolean not null default true;
-- O catálogo é finito e versionado. Dependências não podem formar ciclos nas migrations.
alter table public.tenant_entitlements add foreign key(module_key) references public.module_catalog(key);
insert into private.role_permissions select r,p from unnest(array['clinic_admin','manager','reception']) r cross join unnest(array['agenda.test','packages.test']) p;
insert into private.role_permissions values ('clinic_admin','modules.configure');

create function private.module_enabled(t uuid,k text,seen text[] default '{}') returns boolean
language plpgsql stable security definer set search_path='' as $$
declare deps text[]; d text;
begin
 if k=any(seen) then return false; end if;
 select c.dependencies into deps from public.module_catalog c join public.tenant_entitlements e on e.module_key=c.key
 where c.key=k and e.tenant_id=t and e.enabled and e.configured and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
 and (k='core' or exists(select 1 from public.tenant_subscriptions s where s.tenant_id=t and s.state<>'cancelled'
 and s.valid_from<=now() and (s.valid_until is null or s.valid_until>now())
 and (e.source='override' or exists(select 1 from public.plan_modules pm where pm.plan_key=s.plan_key and pm.module_key=k))));
 if not found then return false; end if;
 foreach d in array deps loop if not private.module_enabled(t,d,seen||k) then return false; end if; end loop;
 return true;
end $$;
create or replace function private.is_allowed(t uuid,u uuid,p text,module text default 'core') returns boolean
language sql stable security definer set search_path='' as $$
 select private.module_enabled(t,module) and
 -- Uma permissão de módulo não pode ser exercida passando core na chamada.
 not exists(select 1 from public.module_catalog c where c.permission=p and c.key<>module) and
 exists(select 1 from public.tenant_memberships m join public.tenants tnt on tnt.id=m.tenant_id and tnt.status='active'
 join private.role_permissions rp on rp.role=m.role and rp.permission=p
 where m.tenant_id=t and m.user_id=auth.uid() and m.status='active'
 and exists(select 1 from public.membership_units mu join public.units un on un.tenant_id=mu.tenant_id and un.id=mu.unit_id and un.active
 where mu.tenant_id=t and mu.membership_id=m.id and (u is null or mu.unit_id=u)))
$$;
create function public.module_probe(tenant uuid,unit uuid,module text) returns text
language plpgsql security definer set search_path='' as $$
declare p text;
begin
 select permission into p from public.module_catalog where key=module and key<>'core';
 if p is null or unit is null or not private.is_allowed(tenant,unit,p,module) then raise exception 'Módulo indisponível neste escopo' using errcode='42501'; end if;
 return 'Permissão de teste autorizada. Tela operacional em etapa futura.';
end $$;
-- Uma relação mínima demonstra RLS do módulo sem antecipar Agenda/Pacotes.
create table public.module_test_records (
 tenant_id uuid not null, unit_id uuid not null, module_key text not null references public.module_catalog(key),
 label text not null default 'Dado sintético de autorização', primary key(tenant_id,unit_id,module_key),
 foreign key(tenant_id,unit_id) references public.units(tenant_id,id)
);
create function private.module_record_allowed(t uuid,u uuid,k text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select private.is_allowed(t,u,c.permission,k) from public.module_catalog c where c.key=k),false)
$$;

-- Mudanças são uma prévia temporária, nunca um entitlement operacional de trial.
create table public.module_changes (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 module_key text not null references public.module_catalog(key), enabled boolean not null,
 actor_id uuid not null references auth.users(id), expires_at timestamptz not null default now()+interval '15 minutes',
 published_at timestamptz, unique(tenant_id,id)
);
create function public.preview_module(tenant uuid,module text,enabled boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.is_allowed(tenant,null,'modules.configure') or not exists(select 1 from public.module_catalog c
 join public.tenant_entitlements e on e.module_key=c.key where c.key=module and c.configurable and e.tenant_id=tenant and e.enabled
 and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now()))
 then raise exception 'Módulo fora da alçada contratada' using errcode='42501'; end if;
 insert into public.module_changes(tenant_id,module_key,enabled,actor_id) values(tenant,module,enabled,auth.uid()) returning id into result;
 return result;
end $$;
create function public.publish_module(change uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.module_changes; d text;
begin
 select * into c from public.module_changes where id=change for update;
 if not found or c.actor_id<>auth.uid() or c.expires_at<=now() or not private.is_allowed(c.tenant_id,null,'modules.configure') then raise exception 'Revisão indisponível' using errcode='42501'; end if;
 perform 1 from public.tenants where id=c.tenant_id for update;
 if c.published_at is not null then return; end if;
 if not exists(select 1 from public.tenant_entitlements e join public.tenant_subscriptions s on s.tenant_id=e.tenant_id
 where e.tenant_id=c.tenant_id and e.module_key=c.module_key and e.enabled and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
 and s.state<>'cancelled' and s.valid_from<=now() and (s.valid_until is null or s.valid_until>now())
 and (e.source='override' or exists(select 1 from public.plan_modules pm where pm.plan_key=s.plan_key and pm.module_key=c.module_key)))
 then raise exception 'Contrato não autoriza módulo' using errcode='42501'; end if;
 if c.enabled then
 for d in select unnest(dependencies) from public.module_catalog where key=c.module_key loop
 if not private.module_enabled(c.tenant_id,d) then raise exception 'Habilite a dependência primeiro' using errcode='42501'; end if;
 end loop;
 elsif exists(select 1 from public.module_catalog mc where c.module_key=any(mc.dependencies) and private.module_enabled(c.tenant_id,mc.key)) then
 raise exception 'Desative módulos dependentes primeiro' using errcode='42501';
 end if;
 update public.tenant_entitlements set configured=c.enabled where tenant_id=c.tenant_id and module_key=c.module_key;
 update public.module_changes set published_at=now() where id=change;
end $$;

create table private.provision_requests (request_id uuid primary key, tenant_id uuid not null references public.tenants(id), payload jsonb not null);
create function private.require_platform() returns void language plpgsql stable security definer set search_path='' as $$
begin if private.platform_role() is distinct from 'superadmin' then raise exception 'Acesso restrito à Zetta' using errcode='42501'; end if; end $$;
create function public.provision_tenant(request uuid,slug text,name text,unit_name text,brand text,responsible text,email text,plan text,timezone text default 'America/Sao_Paulo') returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid; u uuid; payload jsonb; previous private.provision_requests;
begin
 perform private.require_platform();
 payload:=jsonb_build_array(slug,name,unit_name,brand,responsible,lower(trim(email)),plan,timezone);
 if request is null or not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=timezone) then raise exception 'Configuração inválida' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request::text,0));
 select * into previous from private.provision_requests where request_id=request;
 if found then
 if previous.payload<>payload then raise exception 'Chave reutilizada com dados diferentes' using errcode='22023'; end if;
 return previous.tenant_id;
 end if;
 insert into public.tenants(slug,name) values(slug,name) returning id into t;
 insert into public.units(tenant_id,name) values(t,unit_name) returning id into u;
 insert into public.tenant_configuration(tenant_id,brand,responsible_name,timezone) values(t,brand,responsible,timezone);
 insert into public.tenant_subscriptions(tenant_id,plan_key) values(t,plan);
 insert into public.tenant_connections(tenant_id) values(t);
 insert into public.tenant_entitlements(tenant_id,module_key) select t,pm.module_key from public.plan_modules pm where pm.plan_key=plan;
 insert into public.tenant_invitations(tenant_id,unit_id,email,role,invited_by) values(t,u,lower(trim(email)),'clinic_admin',auth.uid());
 insert into private.provision_requests values(request,t,payload);
 return t;
end $$;

-- Auditoria inclui snapshots controlados de configuração; nunca payload externo ou dado clínico.
alter table public.audit_logs add column details jsonb not null default '{}';
create function private.console_event(t uuid,act text,entity text,id text,details jsonb default '{}') returns void
language sql security definer set search_path='' as $$
 insert into public.audit_logs(tenant_id,actor_id,action,entity,entity_id,details) values(t,auth.uid(),act,entity,id,details)
$$;
create function public.set_tenant_status(tenant uuid,suspended boolean,reason text,export_until timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 if coalesce(length(trim(reason)),0)<5 then raise exception 'Informe o motivo' using errcode='22023'; end if;
 perform 1 from public.tenants where id=tenant for update;
 update public.tenants set status=case when suspended then 'suspended' else 'active' end where id=tenant;
 update public.tenant_configuration set suspended_at=case when suspended then now() else null end,export_until=set_tenant_status.export_until where tenant_id=tenant;
 perform private.console_event(tenant,case when suspended then 'suspend' else 'reactivate' end,'tenants',tenant::text,jsonb_build_object('reason',reason,'export_until',export_until));
end $$;
create function public.set_tenant_plan(tenant uuid,plan text,reason text,valid_until timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 if coalesce(length(trim(reason)),0)<5 then raise exception 'Informe o motivo' using errcode='22023'; end if;
 perform 1 from public.tenants where id=tenant for update;
 update public.tenant_subscriptions set plan_key=plan,valid_from=now(),valid_until=set_tenant_plan.valid_until,state='active' where tenant_id=tenant;
 update public.tenant_entitlements set enabled=false where tenant_id=tenant and source='plan';
 insert into public.tenant_entitlements(tenant_id,module_key) select tenant,pm.module_key from public.plan_modules pm where pm.plan_key=plan
 on conflict(tenant_id,module_key) do update set enabled=true where tenant_entitlements.source='plan';
 perform private.console_event(tenant,'plan','tenant_subscriptions',tenant::text,jsonb_build_object('plan',plan,'reason',reason,'valid_until',valid_until));
end $$;
create function public.set_module_override(tenant uuid,module text,enabled boolean,until_at timestamptz,reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 if module='core' or until_at<=now() or until_at is null or coalesce(length(trim(reason)),0)<5 then raise exception 'Override exige motivo e vigência' using errcode='22023'; end if;
 perform 1 from public.tenants where id=tenant for update;
 insert into public.tenant_entitlements(tenant_id,module_key,enabled,source,reason,valid_until)
 values(tenant,module,enabled,'override',reason,until_at) on conflict(tenant_id,module_key)
 do update set enabled=excluded.enabled,source='override',reason=excluded.reason,valid_from=now(),valid_until=excluded.valid_until;
end $$;
create function public.add_tenant_unit(tenant uuid,name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare quota integer; result uuid;
begin
 if private.platform_role() is distinct from 'superadmin' and not private.is_allowed(tenant,null,'members.manage') then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform 1 from public.tenants where id=tenant and status='active' for update;
 if not found then raise exception 'Clínica suspensa' using errcode='42501'; end if;
 select coalesce(s.unit_limit_override,p.unit_limit) into quota from public.tenant_subscriptions s join public.plans p on p.key=s.plan_key
 where s.tenant_id=tenant and s.state<>'cancelled' and s.valid_from<=now() and (s.valid_until is null or s.valid_until>now());
 if quota is null or (select count(*) from public.units where tenant_id=tenant)>=quota then raise exception 'Limite de unidades atingido' using errcode='P0001'; end if;
 insert into public.units(tenant_id,name) values(tenant,name) returning id into result;
 -- Criador clínico recebe somente a nova unidade; não amplia vínculos de terceiros.
 insert into public.membership_units(tenant_id,membership_id,unit_id) select tenant,m.id,result from public.tenant_memberships m where m.tenant_id=tenant and m.user_id=auth.uid() and m.status='active';
 return result;
end $$;
create function public.set_member_scope(tenant uuid,membership uuid,units uuid[],reason text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 perform private.require_platform();
 if cardinality(units) is null or cardinality(units)=0 or coalesce(length(trim(reason)),0)<5 then raise exception 'Escopo e motivo obrigatórios' using errcode='22023'; end if;
 perform 1 from public.tenant_memberships where tenant_id=tenant and id=membership for update;
 if not found then raise exception 'Vínculo inexistente' using errcode='42501'; end if;
 delete from public.membership_units where tenant_id=tenant and membership_id=membership;
 foreach u in array units loop insert into public.membership_units values(tenant,membership,u); end loop;
 perform private.console_event(tenant,'scope','tenant_memberships',membership::text,jsonb_build_object('units',units,'reason',reason));
end $$;

create table public.support_grants (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 grantee uuid not null references auth.users(id), approver uuid not null references auth.users(id),
 reason text not null, scope text not null check(scope in ('diagnostics','export')),
 expires_at timestamptz not null, revoked_at timestamptz
);
create function public.grant_support(tenant uuid,grantee uuid,scope text,minutes integer,reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.require_platform();
 if minutes not between 1 and 60 or minutes is null or coalesce(length(trim(reason)),0)<5 then raise exception 'Motivo e prazo de 1 a 60 minutos obrigatórios' using errcode='22023'; end if;
 if scope='diagnostics' and not exists(select 1 from private.platform_memberships where user_id=grantee and active) then raise exception 'Operador inválido' using errcode='42501'; end if;
 if scope='export' and not exists(select 1 from public.tenant_configuration c join public.tenant_memberships m on m.tenant_id=c.tenant_id
 where c.tenant_id=tenant and c.export_until>=now()+make_interval(mins=>minutes) and m.user_id=grantee and m.status='active' and m.role='clinic_admin')
 then raise exception 'Exportação fora da janela contratual ou destinatário inválido' using errcode='42501'; end if;
 insert into public.support_grants(tenant_id,grantee,approver,reason,scope,expires_at) values(tenant,grantee,auth.uid(),reason,scope,now()+make_interval(mins=>minutes)) returning id into result;
 return result;
end $$;
create function public.revoke_support(grant_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.require_platform(); update public.support_grants set revoked_at=now() where id=grant_id; end $$;
create function public.support_diagnostics(tenant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if private.platform_role() is null or not exists(select 1 from public.support_grants g where g.tenant_id=tenant and g.grantee=auth.uid() and g.scope='diagnostics' and g.revoked_at is null and g.expires_at>now()) then raise exception 'Concessão temporária necessária' using errcode='42501'; end if;
 return (select jsonb_build_object('tenant_id',tenant,'status',t.status,'test_state',c.test_state,'capability_state',c.capability_state,'last_test_at',c.last_test_at,'pending_deliveries',(select count(*) from private.invitation_delivery d where d.tenant_id=tenant and d.state<>'sent')) from public.tenants t join public.tenant_connections c on c.tenant_id=t.id where t.id=tenant);
end $$;
create function public.export_tenant_metadata(tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.support_grants g join public.tenant_configuration c on c.tenant_id=g.tenant_id
 join public.tenant_memberships m on m.tenant_id=g.tenant_id and m.user_id=g.grantee and m.status='active' and m.role='clinic_admin'
 where g.tenant_id=tenant and g.grantee=auth.uid() and g.scope='export' and g.revoked_at is null and g.expires_at>now() and c.export_until>now()) then raise exception 'Exportação não autorizada pelo contrato' using errcode='42501'; end if;
 select jsonb_build_object('tenant',jsonb_build_object('id',t.id,'name',t.name),'units',(select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name)) from public.units u
 join public.membership_units mu on mu.tenant_id=u.tenant_id and mu.unit_id=u.id join public.tenant_memberships m on m.tenant_id=mu.tenant_id and m.id=mu.membership_id
 where u.tenant_id=tenant and m.user_id=auth.uid() and m.status='active')) into result from public.tenants t where t.id=tenant;
 perform private.console_event(tenant,'export','tenants',tenant::text);
 return result;
end $$;
create function private.job_allowed(t uuid,module text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tenants where id=t and status='active') and private.module_enabled(t,module)
$$;

create function public.test_connection(tenant uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 update public.tenant_connections set last_test_at=now(),test_state='blocked',evidence='CAPABILITY_NOT_VERIFIED: sem credencial e sem operação autenticada demonstrada. Solicite homologação FLW.' where tenant_id=tenant;
end $$;
create function public.configure_icon(tenant uuid,account_label text,return_url text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 if coalesce(length(trim(account_label)),0)<2 or length(account_label)>120 then raise exception 'Informe uma referência manual sem credenciais' using errcode='22023'; end if;
 update public.tenant_connections set icon_state='awaiting_validation',icon_account_label=account_label,return_url=configure_icon.return_url,icon_installer=auth.uid(),icon_updated_at=now() where tenant_id=tenant;
end $$;

create table private.invitation_delivery (
 invitation_id uuid primary key, tenant_id uuid not null,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
 attempts integer not null default 0, lease uuid, lease_until timestamptz, last_code text,
 foreign key(tenant_id,invitation_id) references public.tenant_invitations(tenant_id,id)
);
create function public.request_invitation_delivery(invitation uuid) returns text language plpgsql security definer set search_path='' as $$
declare inv public.tenant_invitations; result text;
begin
 select * into inv from public.tenant_invitations where id=invitation;
 if not found or (private.platform_role() is distinct from 'superadmin' and not private.is_allowed(inv.tenant_id,inv.unit_id,'members.manage'))
 or inv.revoked_at is not null or inv.expires_at<=now() or inv.accepted_at is not null
 or not private.job_allowed(inv.tenant_id,'core') then raise exception 'Convite indisponível' using errcode='42501'; end if;
 insert into private.invitation_delivery(invitation_id,tenant_id) values(inv.id,inv.tenant_id) on conflict do nothing;
 update private.invitation_delivery set state='pending',last_code=null where invitation_id=inv.id and (state='failed' or (state='sending' and lease_until<=now()));
 select state into result from private.invitation_delivery where invitation_id=inv.id;
 perform private.console_event(inv.tenant_id,'delivery_requested','tenant_invitations',inv.id::text);
 return result;
end $$;
create function public.claim_invitation_delivery(invitation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.tenant_invitations; d private.invitation_delivery;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Servidor obrigatório' using errcode='42501'; end if;
 select * into d from private.invitation_delivery where invitation_id=invitation for update;
 select * into inv from public.tenant_invitations where id=invitation;
 if d.invitation_id is null or d.state<>'pending' or inv.revoked_at is not null or inv.expires_at<=now() or inv.accepted_at is not null or not private.job_allowed(inv.tenant_id,'core') then return null; end if;
 update private.invitation_delivery set state='sending',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '2 minutes' where invitation_id=invitation returning * into d;
 return jsonb_build_object('email',inv.email,'lease',d.lease);
end $$;
create function public.finish_invitation_delivery(invitation uuid,lease uuid,success boolean) returns void language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Servidor obrigatório' using errcode='42501'; end if;
 update private.invitation_delivery d set state=case when success then 'sent' else 'failed' end,last_code=case when success then 'AUTH_ACCEPTED' else 'AUTH_DELIVERY_FAILED' end,lease_until=null
 where d.invitation_id=invitation and d.lease=finish_invitation_delivery.lease and d.state='sending' and d.lease_until>now() returning tenant_id into t;
 if t is null then raise exception 'Lease inválido ou expirado' using errcode='42501'; end if;
 perform private.console_event(t,'delivery_result','tenant_invitations',invitation::text,jsonb_build_object('success',success));
end $$;
-- Metadados do console acessíveis exclusivamente por RPC global; nenhuma tabela operacional ganha bypass.
create function public.console_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_platform();
 return jsonb_build_object(
 'tenants',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'status',t.status,
 'configuration',(select to_jsonb(c) from public.tenant_configuration c where c.tenant_id=t.id),
 'subscription',(select to_jsonb(s) from public.tenant_subscriptions s where s.tenant_id=t.id),
 'connection',(select to_jsonb(c) from public.tenant_connections c where c.tenant_id=t.id),
 'units',(select coalesce(jsonb_agg(to_jsonb(u)),'[]') from public.units u where u.tenant_id=t.id),
 'entitlements',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.tenant_entitlements e where e.tenant_id=t.id),
 'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'expires_at',i.expires_at,'accepted_at',i.accepted_at,'revoked_at',i.revoked_at,'delivery',coalesce(d.state,'pending'),'attempts',coalesce(d.attempts,0),'last_code',d.last_code)),'[]') from public.tenant_invitations i left join private.invitation_delivery d on d.invitation_id=i.id where i.tenant_id=t.id)
 )),'[]') from public.tenants t),
 'modules',(select jsonb_agg(to_jsonb(c)) from public.module_catalog c),
 'plans',(select jsonb_agg(to_jsonb(p)) from public.plans p),
 'plan_modules',(select jsonb_agg(to_jsonb(p)) from public.plan_modules p),
 'support',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.support_grants g),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select id,tenant_id,actor_id,action,entity,entity_id,created_at,details from public.audit_logs order by id desc limit 100) a)
 );
end $$;

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
 values(t,u,scopes,auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(r->>'id',r->>'membership_id',r->>'user_id',r->>'module_key',r->>'email',r->>'tenant_id'));
 return coalesce(new,old);
end $$;

-- Novas relações: leitura clínica sob RLS, escrita exclusivamente pelas rotinas.
do $$ declare tab text; begin
 foreach tab in array array['module_catalog','plans','plan_modules','tenant_subscriptions','tenant_configuration','tenant_connections','module_test_records','module_changes','support_grants'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated',tab);
 execute format('grant select on public.%I to authenticated',tab);
 end loop;
end $$;
create policy catalog_read on public.module_catalog for select to authenticated using(auth.uid() is not null);
create policy plans_read on public.plans for select to authenticated using(auth.uid() is not null);
create policy plan_modules_read on public.plan_modules for select to authenticated using(auth.uid() is not null);
create policy subscription_read on public.tenant_subscriptions for select to authenticated using(private.is_member(tenant_id));
create policy configuration_read on public.tenant_configuration for select to authenticated using(private.is_member(tenant_id));
create policy connection_read on public.tenant_connections for select to authenticated using(private.is_allowed(tenant_id,null,'members.manage'));
create policy module_records_read on public.module_test_records for select to authenticated using(private.module_record_allowed(tenant_id,unit_id,module_key));
create policy changes_read on public.module_changes for select to authenticated using(actor_id=auth.uid() and private.is_allowed(tenant_id,null,'modules.configure'));
create policy support_read on public.support_grants for select to authenticated using(grantee=auth.uid());
do $$ declare tab text; begin
 foreach tab in array array['tenant_subscriptions','tenant_configuration','tenant_connections','module_changes','support_grants'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',tab);
 end loop;
end $$;
-- Trilha registra antes/depois das configurações autorizadas, sem texto de diagnóstico externo.
create function private.audit_console_details() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.console_event(new.tenant_id,'configuration','TG_'||TG_TABLE_NAME,new.tenant_id::text,
 jsonb_build_object('before',case when TG_OP='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 return new;
end $$;
create trigger entitlement_details after insert or update on public.tenant_entitlements for each row execute function private.audit_console_details();
create trigger subscription_details after insert or update on public.tenant_subscriptions for each row execute function private.audit_console_details();
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_allowed(uuid,uuid,text,text),private.is_member(uuid),private.platform_role(),private.object_allowed(text,text),private.can_manage_membership(uuid,uuid),private.audit_allowed(uuid,uuid,text,uuid[]),private.module_record_allowed(uuid,uuid,text) to authenticated;
-- Restrinja inclusive grants PUBLIC herdados do ambiente em cada RPC nova.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('module_probe','preview_module','publish_module','provision_tenant','set_tenant_status','set_tenant_plan','set_module_override','add_tenant_unit','set_member_scope','grant_support','revoke_support','support_diagnostics','export_tenant_metadata','test_connection','configure_icon','request_invitation_delivery','console_snapshot') loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
revoke all on function public.claim_invitation_delivery(uuid),public.finish_invitation_delivery(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_invitation_delivery(uuid),public.finish_invitation_delivery(uuid,uuid,boolean) to service_role;

-- Aceite inicial usa a autoridade do provisionador; os demais preservam emissor clínico.
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
 or not private.module_enabled(inv.tenant_id,'core')
 -- A autoridade que emitiu o convite precisa continuar vigente no mesmo escopo.
 or (not exists(select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id
 join private.role_permissions rp on rp.role=m.role and rp.permission='members.manage'
 where m.tenant_id=inv.tenant_id and m.user_id=inv.invited_by and m.status='active' and mu.unit_id=inv.unit_id)
 and not exists(select 1 from private.platform_memberships pm join private.provision_requests pr on pr.tenant_id=inv.tenant_id
 where pm.user_id=inv.invited_by and pm.active and pm.role='superadmin' and inv.role='clinic_admin'))
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

