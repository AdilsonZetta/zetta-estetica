-- Contrato Zetta v1. Nenhum transporte FLW homologado nesta etapa.
insert into private.role_permissions values ('clinic_admin','integrations.manage');
create table private.tenant_integrations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 provider text not null default 'flw' check(provider='flw'),
 state text not null default 'pending' check(state in ('pending','active','disabled','credential_expired')),
 account_ref text, secret_ref text, -- Referência ao cofre do servidor, nunca a credencial.
 connection_limit integer not null default 1 check(connection_limit=1),
 unique(tenant_id,id), unique(tenant_id,provider), unique(provider,account_ref)
);
create table private.integration_capabilities (
 tenant_id uuid not null, integration_id uuid not null,
 capability text not null check(capability in ('contact.lookup','card.update','charge.create','automation.trigger','webhook.receive')),
 state text not null default 'pending' check(state in ('pending','read_only','supported','unsupported','error')),
 documentation_url text, account_scope text, limits_redacted text, sample_redacted text,
 tested_at timestamptz, tested_by uuid, proof_ref text,
 primary key(tenant_id,integration_id,capability),
 foreign key(tenant_id,integration_id) references private.tenant_integrations(tenant_id,id),
 check(state not in ('supported','read_only') or (documentation_url is not null and account_scope is not null and limits_redacted is not null and sample_redacted is not null and tested_at is not null and tested_by is not null and proof_ref is not null))
);
create table private.outbox_events (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null,
 integration_id uuid not null, actor_id uuid not null, correlation_id uuid not null,
 operation text not null check(operation in ('contact.lookup','card.update','charge.create','automation.trigger')),
 contract_version integer not null default 1 check(contract_version=1),
 entity_id uuid not null, entity_version integer not null check(entity_version>0),
 simulated boolean not null default false, occurred_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,integration_id,operation,entity_id,entity_version),
 foreign key(tenant_id,unit_id) references public.units(tenant_id,id),
 foreign key(tenant_id,integration_id) references private.tenant_integrations(tenant_id,id)
);
create table private.integration_deliveries (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, integration_id uuid not null, event_id uuid not null,
 rule_key text not null default 'zetta.v1' check(rule_key='zetta.v1'),
 state text not null check(state in ('manual','pending','sending','retry','succeeded','unknown','credential_expired','dead')),
 attempts integer not null default 0 check(attempts between 0 and 5), lease uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default now(), last_code text not null default 'CAPABILITY_NOT_VERIFIED',
 unique(tenant_id,id), unique(tenant_id,event_id,rule_key,integration_id),
 foreign key(tenant_id,event_id) references private.outbox_events(tenant_id,id),
 foreign key(tenant_id,integration_id) references private.tenant_integrations(tenant_id,id)
);
create index deliveries_due on private.integration_deliveries(next_attempt_at) where state in ('pending','retry','sending');
create table private.webhook_inbox (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, integration_id uuid not null,
 provider_event_id text not null, correlation_id uuid not null, provider_version bigint,
 state text not null default 'pending' check(state in ('pending','processed','reconcile','ignored','failed')),
 received_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,integration_id,provider_event_id),
 foreign key(tenant_id,integration_id) references private.tenant_integrations(tenant_id,id)
);
-- Nenhum ingresso/escrita de inbox é concedido enquanto origem e conta não forem comprovadas.
create table private.integration_manual_tasks (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, event_id uuid not null,
 state text not null default 'open' check(state in ('open','done')), external_ref text,
 completed_by uuid, completed_at timestamptz,
 unique(tenant_id,event_id), foreign key(tenant_id,event_id) references private.outbox_events(tenant_id,id)
);
-- Defense in depth: schema não publicado, sem acesso direto nem mesmo via service_role.
do $$ declare n text; begin
 foreach n in array array['tenant_integrations','integration_capabilities','outbox_events','integration_deliveries','webhook_inbox','integration_manual_tasks'] loop
 execute format('alter table private.%I enable row level security',n);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',n);
 end loop;
end $$;
create function private.integration_actor_allowed(t uuid,u uuid,a uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.job_allowed(t,'core') and exists(
 select 1 from public.tenant_memberships m
 join private.role_permissions p on p.role=m.role and p.permission='integrations.manage'
 join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id
 join public.units un on un.tenant_id=mu.tenant_id and un.id=mu.unit_id and un.active
 where m.tenant_id=t and m.user_id=a and m.status='active' and mu.unit_id=u)
$$;
create function public.request_flw_operation(tenant uuid,unit uuid,operation text,entity uuid,version integer,correlation uuid,simulation boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i uuid; e private.outbox_events; d private.integration_deliveries;
begin
 if unit is null or not private.is_allowed(tenant,unit,'integrations.manage','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if operation is null or operation not in ('contact.lookup','card.update','charge.create','automation.trigger') or entity is null or version is null or version<1 or correlation is null or simulation is null then raise exception 'Contrato inválido' using errcode='22023'; end if;
 insert into private.tenant_integrations(tenant_id) values(tenant) on conflict(tenant_id,provider) do nothing;
 select id into i from private.tenant_integrations where tenant_id=tenant and provider='flw';
 insert into private.integration_capabilities(tenant_id,integration_id,capability)
 select tenant,i,c from unnest(array['contact.lookup','card.update','charge.create','automation.trigger','webhook.receive']) c on conflict do nothing;
 -- A chave de evento é fixada pelo contrato, não é um idempotency-key arbitrário do cliente.
 insert into private.outbox_events(tenant_id,unit_id,integration_id,actor_id,correlation_id,operation,entity_id,entity_version,simulated)
 values(tenant,unit,i,auth.uid(),correlation,operation,entity,version,simulation)
 on conflict do nothing returning * into e;
 if e.id is null then
 select * into e from private.outbox_events o where o.tenant_id=tenant and o.integration_id=i and o.operation=request_flw_operation.operation and o.entity_id=entity and o.entity_version=version;
 if e.unit_id<>unit or e.simulated<>simulation then raise exception 'Chave reutilizada com outro contexto' using errcode='22023'; end if;
 else
 insert into private.integration_deliveries(tenant_id,integration_id,event_id,state,last_code) values(tenant,i,e.id,case when simulation then 'pending' else 'manual' end,case when simulation then 'SIMULATION_ONLY' else 'CAPABILITY_NOT_VERIFIED' end);
 if not simulation then insert into private.integration_manual_tasks(tenant_id,event_id) values(tenant,e.id); end if;
 insert into public.audit_logs(tenant_id,actor_id,action,entity,entity_id) values(tenant,auth.uid(),'flw_operation_requested','integration',e.id::text);
 end if;
 select * into d from private.integration_deliveries where tenant_id=tenant and event_id=e.id;
 return jsonb_build_object('event_id',e.id,'delivery_id',d.id,'correlation_id',e.correlation_id,'state',d.state,'code',d.last_code,'simulated',e.simulated);
end $$;
create function public.flw_operations(tenant uuid,unit uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if unit is null or not private.is_allowed(tenant,unit,'integrations.manage','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('event_id',e.id,'delivery_id',d.id,'operation',e.operation,'correlation_id',e.correlation_id,'state',d.state,'code',d.last_code,'attempts',d.attempts,'simulated',e.simulated,'task_id',m.id,'task_state',m.state,'external_ref',m.external_ref) order by e.occurred_at desc)
 from private.outbox_events e join private.integration_deliveries d on d.tenant_id=e.tenant_id and d.event_id=e.id
 left join private.integration_manual_tasks m on m.tenant_id=e.tenant_id and m.event_id=e.id where e.tenant_id=tenant and e.unit_id=unit),'[]'::jsonb);
end $$;
create function public.complete_flw_manual_task(tenant uuid,task uuid,reference text) returns void
language plpgsql security definer set search_path='' as $$
declare e private.outbox_events;
begin
 select o.* into e from private.outbox_events o join private.integration_manual_tasks m on m.tenant_id=o.tenant_id and m.event_id=o.id where m.tenant_id=tenant and m.id=task;
 if not found or not private.is_allowed(tenant,e.unit_id,'integrations.manage','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 -- Somente identificador opaco, sem URL, token ou conteúdo de contato.
 if reference is null or reference !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'Use apenas referência opaca' using errcode='22023'; end if;
 update private.integration_manual_tasks set state='done',external_ref=reference,completed_by=auth.uid(),completed_at=now() where tenant_id=tenant and id=task and state='open';
 if found then insert into public.audit_logs(tenant_id,actor_id,action,entity,entity_id) values(tenant,auth.uid(),'flw_manual_completed','integration',e.id::text); end if;
end $$;
create function public.replay_flw_delivery(tenant uuid,delivery uuid,reconciled boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare d private.integration_deliveries; e private.outbox_events;
begin
 select * into d from private.integration_deliveries where tenant_id=tenant and id=delivery for update;
 select * into e from private.outbox_events where tenant_id=tenant and id=d.event_id;
 if e.id is null or not private.is_allowed(tenant,e.unit_id,'integrations.manage','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if d.state not in ('retry','dead','unknown','credential_expired') or (d.state='unknown' and reconciled is distinct from true) then raise exception 'Reconciliação ou estado incompatível' using errcode='22023'; end if;
 -- Transportes reais continuam manuais, mesmo após replay e prova registrada.
 update private.integration_deliveries set state=case when e.simulated then 'pending' else 'manual' end,attempts=0,lease=null,lease_until=null,next_attempt_at=now(),last_code=case when e.simulated then 'SIMULATION_ONLY' else 'CAPABILITY_NOT_VERIFIED' end where id=d.id;
 insert into private.integration_manual_tasks(tenant_id,event_id) values(tenant,e.id) on conflict do nothing;
 insert into public.audit_logs(tenant_id,actor_id,action,entity,entity_id) values(tenant,auth.uid(),'flw_replay_reconciled_'||coalesce(reconciled,false)::text,'integration',e.id::text);
end $$;
-- Scheduler/service somente. Sem parâmetros de URL, credencial ou payload de fornecedor.
create function public.claim_flw_delivery(tenant uuid,delivery uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.integration_deliveries; e private.outbox_events; i private.tenant_integrations;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Serviço obrigatório' using errcode='42501'; end if;
 select ti.* into i from private.tenant_integrations ti join private.integration_deliveries x on x.tenant_id=ti.tenant_id and x.integration_id=ti.id where x.tenant_id=tenant and x.id=delivery for update of ti;
 select * into d from private.integration_deliveries where tenant_id=tenant and id=delivery for update;
 if d.id is null then return null; end if;
 select * into e from private.outbox_events where tenant_id=tenant and id=d.event_id;
 update private.integration_deliveries set state='unknown',last_code='OUTCOME_UNKNOWN',lease=null,lease_until=null where tenant_id=tenant and integration_id=i.id and state='sending' and lease_until<=now();
 if d.state='sending' then return null; end if;
 if not private.integration_actor_allowed(tenant,e.unit_id,e.actor_id) or i.state in ('disabled','credential_expired') or not e.simulated then return null; end if;
 if d.state not in ('pending','retry') or d.next_attempt_at>now() or d.attempts>=5 then return null; end if;
 if exists(select 1 from private.integration_deliveries x where x.tenant_id=tenant and x.integration_id=i.id and x.state='sending' and x.id<>d.id) then return null; end if;
 -- Versões ultrapassadas não são enviadas. Nenhuma ordenação externa é presumida.
 if exists(select 1 from private.outbox_events x where x.tenant_id=tenant and x.integration_id=i.id and x.entity_id=e.entity_id and x.operation=e.operation and x.entity_version>e.entity_version) then
 update private.integration_deliveries set state='dead',last_code='SUPERSEDED' where id=d.id; return null; end if;
 update private.integration_deliveries set state='sending',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '30 seconds',last_code='SIMULATION_ONLY' where id=d.id returning * into d;
 return jsonb_build_object('tenant_id',tenant,'delivery_id',d.id,'event_id',e.id,'correlation_id',e.correlation_id,'operation',e.operation,'simulated',e.simulated,'lease',d.lease);
end $$;
create function public.finish_flw_delivery(tenant uuid,delivery uuid,lease uuid,outcome text) returns boolean
language plpgsql security definer set search_path='' as $$
declare d private.integration_deliveries; s text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Serviço obrigatório' using errcode='42501'; end if;
 if outcome is null or outcome not in ('SIMULATED_SUCCESS','RATE_LIMITED','CREDENTIAL_EXPIRED','OUTCOME_UNKNOWN','PERMANENT_FAILURE') then raise exception 'Resultado inválido' using errcode='22023'; end if;
 select * into d from private.integration_deliveries where tenant_id=tenant and id=delivery for update;
 if d.id is null or d.state<>'sending' or d.lease is distinct from lease or d.lease_until<=now() then return false; end if;
 s:=case outcome when 'SIMULATED_SUCCESS' then 'succeeded' when 'RATE_LIMITED' then case when d.attempts>=5 then 'dead' else 'retry' end when 'CREDENTIAL_EXPIRED' then 'credential_expired' when 'OUTCOME_UNKNOWN' then 'unknown' else 'dead' end;
 update private.integration_deliveries set state=s,last_code=outcome,lease=null,lease_until=null,next_attempt_at=now()+make_interval(secs=>least(3600,30*(2^d.attempts)::int)) where id=d.id;
 if outcome='CREDENTIAL_EXPIRED' then update private.tenant_integrations set state='credential_expired' where tenant_id=tenant and id=d.integration_id; end if;
 return true;
end $$;
revoke all on function private.integration_actor_allowed(uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.request_flw_operation(uuid,uuid,text,uuid,integer,uuid,boolean),public.flw_operations(uuid,uuid),public.complete_flw_manual_task(uuid,uuid,text),public.replay_flw_delivery(uuid,uuid,boolean),public.claim_flw_delivery(uuid,uuid),public.finish_flw_delivery(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.request_flw_operation(uuid,uuid,text,uuid,integer,uuid,boolean),public.flw_operations(uuid,uuid),public.complete_flw_manual_task(uuid,uuid,text),public.replay_flw_delivery(uuid,uuid,boolean) to authenticated;
grant execute on function public.claim_flw_delivery(uuid,uuid),public.finish_flw_delivery(uuid,uuid,uuid,text) to service_role;
-- Ficha de teste: registrar evidência não habilita transporte nem muda vínculo de conta.
alter table private.integration_capabilities add column account_label_redacted text,
 add column test_result text check(test_result in ('blocked','failed','passed'));
create function public.record_flw_capability_test(tenant uuid,unit uuid,capability text,account_label text,scope text,limits_summary text,sample_summary text,documentation text,proof text,result text) returns void
language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if unit is null or not private.is_allowed(tenant,unit,'integrations.manage','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if capability is null or capability not in ('contact.lookup','card.update','charge.create','automation.trigger','webhook.receive') or result is null or result not in ('blocked','failed','passed')
 or account_label is null or length(account_label) not between 1 and 120 or scope is null or length(scope) not between 1 and 300
 or limits_summary is null or length(limits_summary) not between 1 and 300 or sample_summary is null or length(sample_summary) not between 1 and 500
 or documentation is null or documentation !~ '^https://[^?#@ ]+$' or length(documentation)>500 or proof is null or proof !~ '^[A-Za-z0-9_-]{1,100}$'
 then raise exception 'Ficha inválida; use dados redigidos e referência opaca' using errcode='22023'; end if;
 insert into private.tenant_integrations(tenant_id) values(tenant) on conflict(tenant_id,provider) do nothing;
 select id into i from private.tenant_integrations where tenant_id=tenant and provider='flw';
 insert into private.integration_capabilities(tenant_id,integration_id,capability,account_label_redacted,account_scope,limits_redacted,sample_redacted,documentation_url,proof_ref,tested_by,tested_at,test_result)
 values(tenant,i,capability,account_label,scope,limits_summary,sample_summary,documentation,proof,auth.uid(),now(),result)
 on conflict on constraint integration_capabilities_pkey do update set account_label_redacted=excluded.account_label_redacted,account_scope=excluded.account_scope,limits_redacted=excluded.limits_redacted,sample_redacted=excluded.sample_redacted,documentation_url=excluded.documentation_url,proof_ref=excluded.proof_ref,tested_by=excluded.tested_by,tested_at=excluded.tested_at,test_result=excluded.test_result;
 insert into public.audit_logs(tenant_id,actor_id,action,entity,entity_id) values(tenant,auth.uid(),'flw_test_'||result,'capability',i::text||':'||capability);
end $$;
create function public.flw_capabilities(tenant uuid,unit uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if unit is null or not private.is_allowed(tenant,unit,'integrations.manage','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 return (select jsonb_agg(jsonb_build_object('capability',c,'state','pending','code','CAPABILITY_NOT_VERIFIED','test',(
 select jsonb_build_object('account',x.account_label_redacted,'scope',x.account_scope,'limits',x.limits_redacted,'sample',x.sample_redacted,'documentation',x.documentation_url,'proof',x.proof_ref,'tested_at',x.tested_at,'tested_by',x.tested_by,'result',x.test_result)
 from private.integration_capabilities x where x.tenant_id=tenant and x.capability=c))) from unnest(array['contact.lookup','card.update','charge.create','automation.trigger','webhook.receive']) c);
end $$;
revoke all on function public.record_flw_capability_test(uuid,uuid,text,text,text,text,text,text,text,text),public.flw_capabilities(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.record_flw_capability_test(uuid,uuid,text,text,text,text,text,text,text,text),public.flw_capabilities(uuid,uuid) to authenticated;
