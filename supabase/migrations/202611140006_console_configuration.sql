-- Alteração explícita do checklist e da assinatura, sem atualização direta de autoridade.
create function public.update_onboarding(tenant uuid,state text,brand text,responsible text,reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 if coalesce(length(trim(reason)),0)<5 or coalesce(length(trim(responsible)),0)=0 then raise exception 'Responsável e motivo obrigatórios' using errcode='22023'; end if;
 update public.tenant_configuration set onboarding_state=state,brand=update_onboarding.brand,responsible_name=responsible where tenant_id=tenant;
 perform private.console_event(tenant,'onboarding','tenant_configuration',tenant::text,jsonb_build_object('state',state,'brand',brand,'responsible',responsible,'reason',reason));
end $$;
create function public.update_subscription(tenant uuid,state text,unit_limit integer default null,reason text default '') returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_platform();
 if coalesce(length(trim(reason)),0)<5 then raise exception 'Motivo obrigatório' using errcode='22023'; end if;
 perform 1 from public.tenants where id=tenant for update;
 update public.tenant_subscriptions set state=update_subscription.state,unit_limit_override=unit_limit where tenant_id=tenant;
 perform private.console_event(tenant,'subscription','tenant_subscriptions',tenant::text,jsonb_build_object('state',state,'unit_limit',unit_limit,'reason',reason));
end $$;
revoke all on function public.update_onboarding(uuid,text,text,text,text),public.update_subscription(uuid,text,integer,text) from public,anon;
grant execute on function public.update_onboarding(uuid,text,text,text,text),public.update_subscription(uuid,text,integer,text) to authenticated;
create function public.test_module_change(change uuid,unit uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.module_changes; deps text[]; permitted boolean;
begin
 select * into c from public.module_changes where id=change;
 if not found or c.actor_id<>auth.uid() or c.expires_at<=now() or unit is null or not private.is_allowed(c.tenant_id,unit,'modules.configure') then raise exception 'Prévia indisponível' using errcode='42501'; end if;
 select dependencies into deps from public.module_catalog where key=c.module_key;
 permitted:=exists(select 1 from public.tenant_entitlements e join public.tenant_subscriptions s on s.tenant_id=e.tenant_id
 where e.tenant_id=c.tenant_id and e.module_key=c.module_key and e.enabled and e.valid_from<=now() and (e.valid_until is null or e.valid_until>now())
 and s.state<>'cancelled' and s.valid_from<=now() and (s.valid_until is null or s.valid_until>now())
 and (e.source='override' or exists(select 1 from public.plan_modules pm where pm.plan_key=s.plan_key and pm.module_key=c.module_key)));
 if c.enabled then permitted:=permitted and not exists(select 1 from unnest(deps) d where not private.module_enabled(c.tenant_id,d));
 else permitted:=permitted and not exists(select 1 from public.module_catalog mc where c.module_key=any(mc.dependencies) and private.module_enabled(c.tenant_id,mc.key)); end if;
 return jsonb_build_object('can_publish',permitted,'module',c.module_key,'configured_after',c.enabled,'expires_at',c.expires_at,'operational_access_unchanged',true);
end $$;
revoke all on function public.test_module_change(uuid,uuid) from public,anon;
grant execute on function public.test_module_change(uuid,uuid) to authenticated;
