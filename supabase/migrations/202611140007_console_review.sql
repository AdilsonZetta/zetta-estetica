-- Revisão do console: validação explícita, diagnóstico de convites e trilha de suporte.

create or replace function public.provision_tenant(request uuid,slug text,name text,unit_name text,brand text,responsible text,email text,plan text,timezone text default 'America/Sao_Paulo') returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid; u uuid; payload jsonb; previous private.provision_requests;
begin
 perform private.require_platform();
 if coalesce(length(trim(name)),0)=0 or coalesce(length(trim(slug)),0)=0 or coalesce(length(trim(unit_name)),0)=0 or coalesce(length(trim(brand)),0)=0 or coalesce(length(trim(responsible)),0)=0 or email is null or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Campos obrigatórios inválidos' using errcode='22023'; end if;
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

create or replace function public.set_tenant_status(tenant uuid,suspended boolean,reason text,export_until timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 perform 1 from public.tenants where id=tenant for update;
 if not found then raise exception 'Empresa inexistente' using errcode='22023'; end if;
 if coalesce(length(trim(reason)),0)<5 then raise exception 'Informe o motivo' using errcode='22023'; end if;
 if suspended is null then raise exception 'Estado obrigatório' using errcode='22023'; end if;
 update public.tenants set status=case when suspended then 'suspended' else 'active' end where id=tenant;
 update public.tenant_configuration set suspended_at=case when suspended then now() else null end,export_until=set_tenant_status.export_until where tenant_id=tenant;
 perform private.console_event(tenant,case when suspended then 'suspend' else 'reactivate' end,'tenants',tenant::text,jsonb_build_object('reason',reason,'export_until',export_until));
end $$;

create or replace function public.set_tenant_plan(tenant uuid,plan text,reason text,valid_until timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 perform 1 from public.tenants where id=tenant for update;
 if not found then raise exception 'Empresa inexistente' using errcode='22023'; end if;
 if coalesce(length(trim(reason)),0)<5 then raise exception 'Informe o motivo' using errcode='22023'; end if;
 update public.tenant_subscriptions set plan_key=plan,valid_from=now(),valid_until=set_tenant_plan.valid_until,state='active' where tenant_id=tenant;
 update public.tenant_entitlements set enabled=false where tenant_id=tenant and source='plan';
 insert into public.tenant_entitlements(tenant_id,module_key) select tenant,pm.module_key from public.plan_modules pm where pm.plan_key=plan
 on conflict(tenant_id,module_key) do update set enabled=true where tenant_entitlements.source='plan';
 perform private.console_event(tenant,'plan','tenant_subscriptions',tenant::text,jsonb_build_object('plan',plan,'reason',reason,'valid_until',valid_until));
end $$;

create or replace function public.set_module_override(tenant uuid,module text,enabled boolean,until_at timestamptz,reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 perform 1 from public.tenants where id=tenant for update;
 if not found then raise exception 'Empresa inexistente' using errcode='22023'; end if;
 if module='core' or until_at<=now() or until_at is null or coalesce(length(trim(reason)),0)<5 then raise exception 'Override exige motivo e vigência' using errcode='22023'; end if;
 insert into public.tenant_entitlements(tenant_id,module_key,enabled,source,reason,valid_until)
 values(tenant,module,enabled,'override',reason,until_at) on conflict(tenant_id,module_key)
 do update set enabled=excluded.enabled,source='override',reason=excluded.reason,valid_from=now(),valid_until=excluded.valid_until;
end $$;

create or replace function public.update_onboarding(tenant uuid,state text,brand text,responsible text,reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 perform 1 from public.tenants where id=tenant for update;
 if not found then raise exception 'Empresa inexistente' using errcode='22023'; end if;
 if coalesce(length(trim(reason)),0)<5 or coalesce(length(trim(responsible)),0)=0 then raise exception 'Responsável e motivo obrigatórios' using errcode='22023'; end if;
 update public.tenant_configuration set onboarding_state=state,brand=update_onboarding.brand,responsible_name=responsible where tenant_id=tenant;
 perform private.console_event(tenant,'onboarding','tenant_configuration',tenant::text,jsonb_build_object('state',state,'brand',brand,'responsible',responsible,'reason',reason));
end $$;

create or replace function public.update_subscription(tenant uuid,state text,unit_limit integer default null,reason text default '') returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 perform 1 from public.tenants where id=tenant for update;
 if not found then raise exception 'Empresa inexistente' using errcode='22023'; end if;
 if coalesce(length(trim(reason)),0)<5 then raise exception 'Motivo obrigatório' using errcode='22023'; end if;
 update public.tenant_subscriptions set state=update_subscription.state,unit_limit_override=unit_limit where tenant_id=tenant;
 perform private.console_event(tenant,'subscription','tenant_subscriptions',tenant::text,jsonb_build_object('state',state,'unit_limit',unit_limit,'reason',reason));
end $$;

create or replace function public.test_connection(tenant uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 perform 1 from public.tenants where id=tenant for update;
 if not found then raise exception 'Empresa inexistente' using errcode='22023'; end if;
 update public.tenant_connections set last_test_at=now(),test_state='blocked',evidence='CAPABILITY_NOT_VERIFIED: sem credencial e sem operação autenticada demonstrada. Solicite homologação FLW.' where tenant_id=tenant;
end $$;

create or replace function public.configure_icon(tenant uuid,account_label text,return_url text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 perform 1 from public.tenants where id=tenant for update;
 if not found then raise exception 'Empresa inexistente' using errcode='22023'; end if;
 if coalesce(length(trim(account_label)),0)<2 or length(account_label)>120 then raise exception 'Informe uma referência manual sem credenciais' using errcode='22023'; end if;
 update public.tenant_connections set icon_state='awaiting_validation',icon_account_label=account_label,return_url=configure_icon.return_url,icon_installer=auth.uid(),icon_updated_at=now() where tenant_id=tenant;
end $$;

create or replace function public.grant_support(tenant uuid,grantee uuid,scope text,minutes integer,reason text) returns uuid
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
 perform private.console_event(tenant,'support_granted','support_grants',result::text,jsonb_build_object('scope',scope,'grantee',grantee,'approver',auth.uid(),'minutes',minutes,'expires_at',now()+make_interval(mins=>minutes),'reason',reason));
 return result;
end $$;

create or replace function public.revoke_support(grant_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare g public.support_grants;
begin
 perform private.require_platform();
 update public.support_grants set revoked_at=now() where id=grant_id returning * into g;
 if not found then raise exception 'Concessão inexistente' using errcode='22023'; end if;
 perform private.console_event(g.tenant_id,'support_revoked','support_grants',g.id::text,jsonb_build_object('scope',g.scope,'grantee',g.grantee,'approver',g.approver,'expires_at',g.expires_at,'reason',g.reason,'revoked_at',g.revoked_at));
end $$;

create or replace function public.support_diagnostics(tenant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if private.platform_role() is null or not exists(select 1 from public.support_grants g where g.tenant_id=tenant and g.grantee=auth.uid() and g.scope='diagnostics' and g.revoked_at is null and g.expires_at>now()) then raise exception 'Concessão temporária necessária' using errcode='42501'; end if;
 return (select jsonb_build_object('tenant_id',tenant,'status',t.status,'test_state',c.test_state,'capability_state',c.capability_state,'last_test_at',c.last_test_at,'pending_deliveries',(select count(*) from public.tenant_invitations i left join private.invitation_delivery d on d.invitation_id=i.id where i.tenant_id=tenant and i.revoked_at is null and i.accepted_at is null and i.expires_at>now() and coalesce(d.state,'pending')<>'sent')) from public.tenants t join public.tenant_connections c on c.tenant_id=t.id where t.id=tenant);
end $$;
