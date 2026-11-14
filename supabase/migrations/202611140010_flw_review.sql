-- Revisão Prompt 04: candidatos elegíveis antes do LIMIT; leases vencidos só reconciliam.
create function public.flw_work_candidates(tenant uuid,unit uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if unit is null or not private.is_allowed(tenant,unit,'integrations.manage','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(j) order by j.occurred_at,j.delivery_id) from (
 select d.id as delivery_id,e.id as event_id,e.correlation_id,e.simulated,e.occurred_at
 from private.outbox_events e
 join private.integration_deliveries d on d.tenant_id=e.tenant_id and d.event_id=e.id
 join private.tenant_integrations ti on ti.tenant_id=d.tenant_id and ti.id=d.integration_id
 where e.tenant_id=tenant and e.unit_id=unit and e.simulated
 and private.integration_actor_allowed(tenant,e.unit_id,e.actor_id)
 and ((d.state in ('pending','retry') and d.next_attempt_at<=now() and d.attempts<5
       and ti.state not in ('disabled','credential_expired')
       and not exists(select 1 from private.integration_deliveries active where active.tenant_id=d.tenant_id and active.integration_id=d.integration_id and active.state='sending' and active.lease_until>now()))
      or (d.state='sending' and d.lease_until<=now()))
 order by e.occurred_at,d.id limit 10
 ) j),'[]'::jsonb);
end $$;
revoke all on function public.flw_work_candidates(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.flw_work_candidates(uuid,uuid) to authenticated;

create or replace function public.replay_flw_delivery(tenant uuid,delivery uuid,reconciled boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare d private.integration_deliveries; e private.outbox_events;
begin
 select * into d from private.integration_deliveries where tenant_id=tenant and id=delivery for update;
 select * into e from private.outbox_events where tenant_id=tenant and id=d.event_id;
 if e.id is null or not private.is_allowed(tenant,e.unit_id,'integrations.manage','core') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if d.last_code='SUPERSEDED' or d.state not in ('retry','dead','unknown','credential_expired') or (d.state='unknown' and reconciled is distinct from true) then raise exception 'Reconciliação ou estado incompatível' using errcode='22023'; end if;
 if exists(select 1 from private.tenant_integrations ti where ti.tenant_id=tenant and ti.id=d.integration_id and ti.state in ('disabled','credential_expired')) then raise exception 'Conexão indisponível; recupere antes do replay' using errcode='22023'; end if;
 -- Transportes reais continuam manuais, mesmo após replay e prova registrada.
 update private.integration_deliveries set state=case when e.simulated then 'pending' else 'manual' end,attempts=0,lease=null,lease_until=null,next_attempt_at=now(),last_code=case when e.simulated then 'SIMULATION_ONLY' else 'CAPABILITY_NOT_VERIFIED' end where id=d.id;
 if not e.simulated then insert into private.integration_manual_tasks(tenant_id,event_id) values(tenant,e.id) on conflict do nothing; end if;
 insert into public.audit_logs(tenant_id,actor_id,action,entity,entity_id) values(tenant,auth.uid(),'flw_replay_reconciled_'||coalesce(reconciled,false)::text,'integration',e.id::text);
end $$;
