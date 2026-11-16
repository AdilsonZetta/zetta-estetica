-- Prompt 07: agenda e reservas transacionais.
-- Ocupação ativa: tstzrange [) com buffers, exclusão GiST por (tenant, recurso).
-- Holds vencidos, cancelamento e falta liberam o intervalo. Confirmado e check-in mantêm.
-- Reagendamento substitui os intervalos na mesma transação; falha preserva o original.
-- pg_cron é opcional: a limpeza também roda dentro das RPCs e em expire_agenda_holds.

insert into private.role_permissions
select r, p from unnest(array['clinic_admin','manager','reception']) r
cross join unnest(array['agenda.read','agenda.book']) p;
insert into private.role_permissions
select r, 'agenda.read' from unnest(array['professional','finance','auditor']) r;

create table private.appointments (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null,
 client_id uuid not null, service_id uuid not null, service_version_id uuid not null,
 state text not null check (state in ('held','confirmed','checked_in','cancelled','no_show','expired')),
 version integer not null default 1 check (version > 0),
 starts_at timestamptz not null, ends_at timestamptz not null,
 timezone text not null, local_start timestamp not null, local_end timestamp not null,
 hold_expires_at timestamptz, cancel_reason text not null default '' check (length(cancel_reason) <= 500),
 waitlist_entry_id uuid, created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (tenant_id, id),
 foreign key (tenant_id, unit_id) references public.units(tenant_id, id),
 foreign key (tenant_id, unit_id, client_id) references private.clients(tenant_id, unit_id, id),
 foreign key (tenant_id, service_id) references private.catalog_services(tenant_id, id),
 foreign key (tenant_id, service_version_id) references private.catalog_service_versions(tenant_id, id),
 check (ends_at > starts_at), check (local_end > local_start),
 check ((state = 'held') = (hold_expires_at is not null))
);
create index agenda_appointments_when on private.appointments(tenant_id, unit_id, starts_at);
create index agenda_holds_due on private.appointments(hold_expires_at) where state = 'held';

create table private.agenda_blocks (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null, resource_id uuid not null,
 period tstzrange not null, timezone text not null, local_start timestamp not null, local_end timestamp not null,
 reason text not null check (length(btrim(reason)) between 1 and 500),
 active boolean not null default true, version integer not null default 1 check (version > 0),
 created_by uuid not null, created_at timestamptz not null default now(),
 unique (tenant_id, id),
 foreign key (tenant_id, unit_id) references public.units(tenant_id, id),
 foreign key (tenant_id, resource_id, unit_id) references private.catalog_resource_units(tenant_id, resource_id, unit_id),
 check (not isempty(period) and lower_inc(period) and not upper_inc(period) and not lower_inf(period) and not upper_inf(period)),
 check (local_end > local_start and local_end - local_start <= interval '31 days')
);

create table private.appointment_resources (
 tenant_id uuid not null, appointment_id uuid not null, resource_id uuid not null, unit_id uuid not null,
 primary key (tenant_id, appointment_id, resource_id),
 foreign key (tenant_id, appointment_id) references private.appointments(tenant_id, id),
 foreign key (tenant_id, resource_id, unit_id) references private.catalog_resource_units(tenant_id, resource_id, unit_id)
);

-- Uma identidade física ou profissional, uma vez por intervalo, em qualquer unidade.
create table private.resource_reservations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, resource_id uuid not null, unit_id uuid not null,
 period tstzrange not null, occupies boolean not null default true,
 appointment_id uuid, block_id uuid,
 check (num_nonnulls(appointment_id, block_id) = 1),
 check (not isempty(period) and lower_inc(period) and not upper_inc(period)),
 foreign key (tenant_id, resource_id) references private.catalog_resources(tenant_id, id),
 foreign key (tenant_id, resource_id, unit_id) references private.catalog_resource_units(tenant_id, resource_id, unit_id),
 foreign key (tenant_id, appointment_id) references private.appointments(tenant_id, id),
 foreign key (tenant_id, block_id) references private.agenda_blocks(tenant_id, id),
 exclude using gist (tenant_id with =, resource_id with =, period with &&) where (occupies)
);
create index agenda_reservations_resource on private.resource_reservations(tenant_id, resource_id) where occupies;

create table private.waitlist_entries (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null,
 client_id uuid not null, service_id uuid not null, service_version_id uuid not null,
 priority integer not null default 50 check (priority between 1 and 100),
 state text not null default 'waiting' check (state in ('waiting','offered','accepted','cancelled','expired')),
 notes text not null default '' check (length(notes) <= 500),
 appointment_id uuid, version integer not null default 1 check (version > 0),
 created_by uuid not null, created_at timestamptz not null default now(),
 unique (tenant_id, id),
 foreign key (tenant_id, unit_id, client_id) references private.clients(tenant_id, unit_id, id),
 foreign key (tenant_id, service_version_id) references private.catalog_service_versions(tenant_id, id),
 foreign key (tenant_id, service_id) references private.catalog_services(tenant_id, id),
 foreign key (tenant_id, appointment_id) references private.appointments(tenant_id, id)
);
alter table private.appointments add constraint appointments_waitlist_fkey
 foreign key (tenant_id, waitlist_entry_id) references private.waitlist_entries(tenant_id, id);
create index agenda_waitlist_queue on private.waitlist_entries(tenant_id, unit_id, state, priority desc, created_at);

create table private.waitlist_windows (
 tenant_id uuid not null, entry_id uuid not null, period tstzrange not null,
 timezone text not null, local_start timestamp not null, local_end timestamp not null,
 primary key (tenant_id, entry_id, local_start),
 foreign key (tenant_id, entry_id) references private.waitlist_entries(tenant_id, id),
 check (not isempty(period) and lower_inc(period) and not upper_inc(period)),
 check (local_end > local_start and local_end - local_start <= interval '31 days')
);
create table private.waitlist_professionals (
 tenant_id uuid not null, entry_id uuid not null, resource_id uuid not null,
 primary key (tenant_id, entry_id, resource_id),
 foreign key (tenant_id, entry_id) references private.waitlist_entries(tenant_id, id),
 foreign key (tenant_id, resource_id) references private.catalog_resources(tenant_id, id)
);

create table private.agenda_outbox (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, unit_id uuid not null,
 event_name text not null check (event_name in (
  'appointment.held.v1','appointment.confirmed.v1','appointment.checked_in.v1','appointment.rescheduled.v1',
  'appointment.cancelled.v1','appointment.no_show.v1','appointment.expired.v1',
  'agenda.block.created.v1','agenda.block.released.v1',
  'waitlist.joined.v1','waitlist.offered.v1','waitlist.accepted.v1','waitlist.cancelled.v1')),
 entity_id uuid not null, entity_version integer not null check (entity_version > 0),
 correlation_id uuid not null, payload jsonb not null,
 actor_id uuid, occurred_at timestamptz not null default now(),
 simulated boolean not null default true, delivery_code text not null default 'CAPABILITY_NOT_VERIFIED',
 unique (tenant_id, id), unique (tenant_id, event_name, entity_id, entity_version),
 foreign key (tenant_id, unit_id) references public.units(tenant_id, id)
);
create table private.agenda_manual_tasks (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, event_id uuid not null,
 state text not null default 'open' check (state in ('open','done')),
 code text not null default 'CAPABILITY_NOT_VERIFIED',
 instruction text not null, completed_by uuid, completed_at timestamptz,
 unique (tenant_id, event_id), foreign key (tenant_id, event_id) references private.agenda_outbox(tenant_id, id)
);
create table private.agenda_idempotency (
 tenant_id uuid not null, operation text not null, idempotency_key text not null,
 request_hash text not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key (tenant_id, operation, idempotency_key),
 foreign key (tenant_id) references public.tenants(id)
);

do $$ declare n text; begin
 foreach n in array array['appointments','agenda_blocks','appointment_resources','resource_reservations','waitlist_entries','waitlist_windows','waitlist_professionals','agenda_outbox','agenda_manual_tasks','agenda_idempotency'] loop
  execute format('alter table private.%I enable row level security', n);
  execute format('revoke all on private.%I from public, anon, authenticated, service_role', n);
 end loop;
end $$;

create function private.agenda_assert(t uuid, u uuid, p text) returns void
language plpgsql stable set search_path='' as $$ begin
 if u is null or not private.is_allowed(t, u, p, 'agenda') then raise exception 'Acesso à agenda negado' using errcode='42501'; end if;
end $$;

create function private.agenda_key(k text) returns text
language plpgsql immutable set search_path='' as $$ begin
 if k is null or k !~ '^[A-Za-z0-9_.:-]{8,80}$' then raise exception 'Chave idempotente inválida' using errcode='22023'; end if;
 return k;
end $$;

create function private.agenda_emit(t uuid, u uuid, event_name text, entity uuid, entity_version integer, payload jsonb, manual boolean) returns uuid
language plpgsql set search_path='' as $$ declare eid uuid; begin
 insert into private.agenda_outbox(tenant_id, unit_id, event_name, entity_id, entity_version, correlation_id, payload, actor_id)
 values (t, u, event_name, entity, entity_version, entity, payload, auth.uid()) returning id into eid;
 if manual then
  insert into private.agenda_manual_tasks(tenant_id, event_id, instruction)
  values (t, eid, 'A FLW não está comprovada (CAPABILITY_NOT_VERIFIED). Avise o cliente por um canal manual e guarde só uma referência opaca.');
 end if;
 insert into public.audit_logs(tenant_id, unit_id, actor_id, entity, entity_id, action)
 values (t, u, auth.uid(), 'appointment', entity::text, event_name);
 return eid;
end $$;

create function private.agenda_payload(t uuid, appointment uuid, message text default null) returns jsonb
language plpgsql stable set search_path='' as $$ declare a private.appointments; resources jsonb; begin
 select * into a from private.appointments x where x.tenant_id=t and x.id=appointment;
 select coalesce(jsonb_agg(ar.resource_id order by ar.resource_id), '[]'::jsonb) into resources
 from private.appointment_resources ar where ar.tenant_id=t and ar.appointment_id=appointment;
 return jsonb_build_object(
  'appointment_id', a.id, 'state', a.state, 'version', a.version,
  'starts_at', a.starts_at, 'ends_at', a.ends_at, 'local_start', a.local_start, 'local_end', a.local_end,
  'timezone', a.timezone, 'hold_expires_at', a.hold_expires_at,
  'service_id', a.service_id, 'service_version_id', a.service_version_id, 'client_id', a.client_id, 'unit_id', a.unit_id,
  'resource_ids', resources, 'waitlist_entry_id', a.waitlist_entry_id, 'message', message, 'contract', 1);
end $$;

create function private.agenda_lock_resources(ids uuid[]) returns void
language plpgsql set search_path='' as $$ declare rid uuid; begin
 for rid in select x from unnest(ids) x order by x loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('agenda-resource:'||rid::text, 0));
 end loop;
end $$;

-- Libera holds vencidos sob lock. resources/span nulos varrem o que estiver vencido.
create function private.agenda_release_expired(resources uuid[] default null, span tstzrange default null) returns integer
language plpgsql set search_path='' as $$
declare ids uuid[] := '{}'; rid uuid; n integer; begin
 for rid in
  select a.id from private.appointments a
  where a.state='held' and a.hold_expires_at <= now()
  and (resources is null or exists (
   select 1 from private.resource_reservations rr
   where rr.tenant_id=a.tenant_id and rr.appointment_id=a.id and rr.occupies and rr.resource_id = any(resources)
   and (span is null or rr.period && span)))
  order by a.id
  for update of a
 loop ids := ids || rid; end loop;
 if coalesce(cardinality(ids), 0) = 0 then return 0; end if;
 update private.appointments a set state='expired', hold_expires_at=null, version=a.version+1, updated_at=now() where a.id = any(ids);
 update private.resource_reservations rr set occupies=false where rr.appointment_id = any(ids) and rr.occupies;
 update private.waitlist_entries w set state='waiting', appointment_id=null, version=w.version+1
 where w.appointment_id = any(ids) and w.state='offered';
 insert into private.agenda_outbox(tenant_id, unit_id, event_name, entity_id, entity_version, correlation_id, payload, actor_id)
 select a.tenant_id, a.unit_id, 'appointment.expired.v1', a.id, a.version, a.id,
  jsonb_build_object('appointment_id', a.id, 'client_id', a.client_id, 'service_version_id', a.service_version_id, 'state', a.state, 'contract', 1),
  auth.uid()
 from private.appointments a where a.id = any(ids);
 insert into public.audit_logs(tenant_id, unit_id, actor_id, entity, entity_id, action)
 select a.tenant_id, a.unit_id, auth.uid(), 'appointment', a.id::text, 'appointment.expired.v1' from private.appointments a where a.id = any(ids);
 get diagnostics n = row_count;
 return coalesce(cardinality(ids), 0);
end $$;

create function private.expire_agenda_holds_job() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer; m integer; begin
 n := private.agenda_release_expired(null, null);
 update private.waitlist_entries w set state='expired', version=w.version+1
 where w.state='waiting' and not exists (
  select 1 from private.waitlist_windows ww where ww.tenant_id=w.tenant_id and ww.entry_id=w.id and upper(ww.period) > now());
 get diagnostics m = row_count;
 return n + m;
end $$;

create function private.agenda_conflict(t uuid, resources uuid[], span tstzrange, tz text, except_appointment uuid) returns text
language plpgsql stable set search_path='' as $$
declare n text; a timestamp; b timestamp; begin
 select r.name, lower(rr.period) at time zone tz, upper(rr.period) at time zone tz into n, a, b
 from private.resource_reservations rr
 join private.catalog_resources r on r.tenant_id=rr.tenant_id and r.id=rr.resource_id
 left join private.appointments ap on ap.tenant_id=rr.tenant_id and ap.id=rr.appointment_id
 where rr.tenant_id=t and rr.occupies and rr.resource_id = any(resources) and rr.period && span
 and (except_appointment is null or rr.appointment_id is distinct from except_appointment)
 and (ap.id is null or ap.state <> 'held' or ap.hold_expires_at > now())
 order by r.name limit 1;
 if n is null then return null; end if;
 return format('Conflito de reserva: %s está ocupado entre %s e %s (intervalo com buffers). Escolha outro horário.', n, to_char(a, 'YYYY-MM-DD HH24:MI'), to_char(b, 'YYYY-MM-DD HH24:MI'));
end $$;

create function private.agenda_slot(t uuid, u uuid, version uuid, local_start timestamp, resources uuid[], fresh boolean) returns jsonb
language plpgsql stable set search_path='' as $$
declare v private.catalog_service_versions; current_version integer; tz text; local_end timestamp;
 a timestamptz; b timestamptz; ba timestamptz; bb timestamptz; rid uuid; n text; rkind text; req record; named boolean;
begin
 if resources is null or coalesce(cardinality(resources), 0) not between 1 and 12
  or (select count(*) from unnest(resources) x) <> (select count(distinct x) from unnest(resources) x) then
  raise exception 'Selecione de 1 a 12 recursos distintos' using errcode='22023'; end if;
 select sv.* into v from private.catalog_service_versions sv where sv.tenant_id=t and sv.id=agenda_slot.version;
 if v.id is null then raise exception 'Serviço indisponível' using errcode='42501'; end if;
 select s.current_version into current_version from private.catalog_services s where s.tenant_id=t and s.id=v.service_id;
 if fresh and (v.version is distinct from current_version or v.state <> 'published') then
  raise exception 'Versão não disponível para nova reserva' using errcode='22023'; end if;
 if not exists (select 1 from private.catalog_service_units su where su.tenant_id=t and su.version_id=v.id and su.unit_id=u) then
  raise exception 'Serviço indisponível nesta unidade' using errcode='22023'; end if;
 select un.timezone into tz from public.units un where un.tenant_id=t and un.id=u and un.active;
 local_end := local_start + make_interval(mins => v.duration_minutes);
 a := local_start at time zone tz; b := local_end at time zone tz;
 if local_start is null or b <= a or a at time zone tz <> local_start or b at time zone tz <> local_end then
  raise exception 'Horário local inválido no fuso da unidade' using errcode='22023'; end if;
 ba := a - make_interval(mins => v.buffer_before); bb := b + make_interval(mins => v.buffer_after);
 if (select count(*) from private.catalog_resources r where r.tenant_id=t and r.id = any(resources) and r.kind='professional') <> 1 then
  raise exception 'A reserva exige exatamente um profissional habilitado' using errcode='22023'; end if;
 foreach rid in array resources loop
  select r.name, r.kind into n, rkind from private.catalog_resources r
  join private.catalog_resource_units ru on ru.tenant_id=r.tenant_id and ru.resource_id=r.id and ru.unit_id=u
  where r.tenant_id=t and r.id=rid and r.active;
  if n is null then raise exception 'Recurso indisponível na unidade' using errcode='22023'; end if;
  if rkind='professional' then
   if not exists (select 1 from private.catalog_service_resources sr where sr.tenant_id=t and sr.version_id=v.id and sr.unit_id=u and sr.resource_id=rid) then
    raise exception 'Profissional não habilitado nesta versão' using errcode='22023'; end if;
   -- Sem membership o recurso segue operacional. Com membership, o escopo precisa estar vigente.
   if exists (select 1 from private.catalog_resources r where r.tenant_id=t and r.id=rid and r.membership_id is not null)
    and not exists (select 1 from private.catalog_resources r join public.tenant_memberships m on m.tenant_id=r.tenant_id and m.id=r.membership_id and m.status='active'
    join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id and mu.unit_id=u
    where r.tenant_id=t and r.id=rid) then
    raise exception 'Vínculo do profissional sem escopo vigente' using errcode='22023'; end if;
  else
   named := exists (select 1 from private.catalog_service_resources sr join private.catalog_resources cr on cr.tenant_id=sr.tenant_id and cr.id=sr.resource_id
    where sr.tenant_id=t and sr.version_id=v.id and sr.unit_id=u and cr.kind=rkind);
   if named and not exists (select 1 from private.catalog_service_resources sr where sr.tenant_id=t and sr.version_id=v.id and sr.unit_id=u and sr.resource_id=rid) then
    raise exception 'Recurso físico fora dos nominados na versão' using errcode='22023'; end if;
   if not named and not exists (select 1 from private.catalog_requirements q join private.catalog_resources r on r.tenant_id=t and r.id=rid
    join private.catalog_resource_units ru on ru.tenant_id=r.tenant_id and ru.resource_id=r.id and ru.unit_id=u
    where q.tenant_id=t and q.version_id=v.id and q.kind=r.kind and q.capability = any(r.capabilities) and ru.capacity >= q.quantity) then
    raise exception 'Recurso físico não atende às exigências da versão' using errcode='22023'; end if;
  end if;
  if not exists (select 1 from private.catalog_windows w where w.tenant_id=t and w.resource_id=rid and w.unit_id=u and w.kind in ('shift','exception') and w.period @> tstzrange(ba, bb, '[)')) then
   raise exception 'Jornada não cobre % entre % e % (buffers inclusos)', n, ba at time zone tz, bb at time zone tz using errcode='22023'; end if;
  if exists (select 1 from private.catalog_windows w where w.tenant_id=t and w.resource_id=rid and w.kind in ('off','holiday') and w.period && tstzrange(ba, bb, '[)')) then
   raise exception 'Folga ou feriado bloqueia %', n using errcode='22023'; end if;
 end loop;
 for req in select q.kind, q.capability, q.quantity from private.catalog_requirements q where q.tenant_id=t and q.version_id=v.id loop
  if not exists (select 1 from private.catalog_resources r join private.catalog_resource_units ru on ru.tenant_id=r.tenant_id and ru.resource_id=r.id and ru.unit_id=u
   where r.tenant_id=t and r.id = any(resources) and r.kind=req.kind and req.capability = any(r.capabilities) and ru.capacity >= req.quantity
   and (not exists (select 1 from private.catalog_service_resources sr join private.catalog_resources cr on cr.tenant_id=sr.tenant_id and cr.id=sr.resource_id
    where sr.tenant_id=t and sr.version_id=v.id and sr.unit_id=u and cr.kind=req.kind)
    or exists (select 1 from private.catalog_service_resources sr where sr.tenant_id=t and sr.version_id=v.id and sr.unit_id=u and sr.resource_id=r.id))) then
   raise exception 'Recursos não atendem a exigência de % · %', req.kind, req.capability using errcode='22023'; end if;
 end loop;
 return jsonb_build_object('service_id', v.service_id, 'starts_at', a, 'ends_at', b, 'local_end', local_end, 'timezone', tz, 'buffer_start', ba, 'buffer_end', bb);
end $$;

create function private.agenda_occupy(t uuid, appointment uuid, u uuid, resources uuid[], ba timestamptz, bb timestamptz, tz text) returns void
language plpgsql set search_path='' as $$ declare rid uuid; n text; begin
 foreach rid in array resources loop
  begin
   insert into private.resource_reservations(tenant_id, resource_id, unit_id, period, occupies, appointment_id)
   values (t, rid, u, tstzrange(ba, bb, '[)'), true, appointment);
  exception when exclusion_violation then
   select r.name into n from private.catalog_resources r where r.tenant_id=t and r.id=rid;
   raise exception '%', format('Conflito de reserva: %s está ocupado entre %s e %s (intervalo com buffers). Escolha outro horário.', n, to_char(ba at time zone tz, 'YYYY-MM-DD HH24:MI'), to_char(bb at time zone tz, 'YYYY-MM-DD HH24:MI')) using errcode='23P01';
  end;
 end loop;
 insert into private.appointment_resources(tenant_id, appointment_id, resource_id, unit_id)
 select t, appointment, x, u from unnest(resources) x;
end $$;

create function private.agenda_replay(t uuid, operation text, k text, hash text) returns jsonb
language plpgsql set search_path='' as $$ declare existing jsonb; stored text; begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('agenda-key:'||t::text||':'||operation||':'||k, 0));
 select i.result, i.request_hash into existing, stored from private.agenda_idempotency i
 where i.tenant_id=t and i.operation=agenda_replay.operation and i.idempotency_key=k;
 if found then
  if stored is distinct from hash then raise exception 'Chave reutilizada com outro conteúdo' using errcode='22023'; end if;
  return existing;
 end if;
 return null;
end $$;

create function private.agenda_remember(t uuid, operation text, k text, hash text, result jsonb) returns jsonb
language plpgsql set search_path='' as $$ begin
 insert into private.agenda_idempotency(tenant_id, operation, idempotency_key, request_hash, result) values (t, operation, k, hash, result);
 return result;
end $$;

create function public.agenda_reserve(tenant uuid, unit uuid, client uuid, version_id uuid, local_start timestamp, resources uuid[], idempotency_key text, hold_minutes integer default 10, confirm boolean default false, waitlist_entry uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare key text := private.agenda_key(idempotency_key); hash text; replay jsonb; slot jsonb; span tstzrange; msg text; aid uuid; result jsonb;
 mins integer := coalesce(hold_minutes, 10); entry private.waitlist_entries; event_name text;
begin
 perform private.agenda_assert(tenant, unit, 'agenda.book');
 hash := pg_catalog.md5(concat_ws('|', tenant::text, unit::text, client::text, version_id::text, local_start::text,
  coalesce((select string_agg(x::text, ',' order by x::text) from unnest(resources) x), ''), mins::text, coalesce(confirm, false)::text, coalesce(waitlist_entry::text, '')));
 replay := private.agenda_replay(tenant, 'reserve', key, hash);
 if replay is not null then return replay; end if;
 if mins not between 1 and 30 then raise exception 'A reserva temporária deve durar de 1 a 30 minutos' using errcode='22023'; end if;
 if not exists (select 1 from private.clients c where c.tenant_id=tenant and c.unit_id=unit and c.id=client and c.state='active') then
  raise exception 'Cliente indisponível nesta unidade' using errcode='22023'; end if;
 slot := private.agenda_slot(tenant, unit, version_id, local_start, resources, true);
 perform private.agenda_lock_resources(resources);
 span := tstzrange((slot->>'buffer_start')::timestamptz, (slot->>'buffer_end')::timestamptz, '[)');
 perform private.agenda_release_expired(resources, span);
 if waitlist_entry is not null then
  select * into entry from private.waitlist_entries w where w.tenant_id=tenant and w.id=waitlist_entry for update;
  if entry.id is null or entry.unit_id <> unit then raise exception 'Encaixe indisponível' using errcode='42501'; end if;
  if entry.state <> 'waiting' then raise exception 'Encaixe indisponível para nova reserva' using errcode='22023'; end if;
  if entry.client_id <> client or entry.service_version_id <> version_id then raise exception 'Encaixe não corresponde ao cliente ou à versão do serviço' using errcode='22023'; end if;
  if not exists (select 1 from private.waitlist_windows ww where ww.tenant_id=tenant and ww.entry_id=entry.id and ww.period @> tstzrange((slot->>'starts_at')::timestamptz, (slot->>'ends_at')::timestamptz, '[)')) then
   raise exception 'O horário fica fora das janelas aceitas na lista de espera' using errcode='22023'; end if;
  if exists (select 1 from private.waitlist_professionals wp where wp.tenant_id=tenant and wp.entry_id=entry.id)
   and not exists (select 1 from private.waitlist_professionals wp where wp.tenant_id=tenant and wp.entry_id=entry.id and wp.resource_id = any(resources)) then
   raise exception 'O profissional não está entre os aceitos na lista de espera' using errcode='22023'; end if;
 end if;
 msg := private.agenda_conflict(tenant, resources, span, slot->>'timezone', null);
 if msg is not null then raise exception '%', msg using errcode='23P01'; end if;
 insert into private.appointments(tenant_id, unit_id, client_id, service_id, service_version_id, state, starts_at, ends_at, timezone, local_start, local_end, hold_expires_at, waitlist_entry_id, created_by)
 values (tenant, unit, client, (slot->>'service_id')::uuid, version_id, case when coalesce(confirm, false) then 'confirmed' else 'held' end,
  (slot->>'starts_at')::timestamptz, (slot->>'ends_at')::timestamptz, slot->>'timezone', local_start, (slot->>'local_end')::timestamp,
  case when coalesce(confirm, false) then null else now() + make_interval(mins => mins) end, waitlist_entry, auth.uid())
 returning id into aid;
 perform private.agenda_occupy(tenant, aid, unit, resources, (slot->>'buffer_start')::timestamptz, (slot->>'buffer_end')::timestamptz, slot->>'timezone');
 event_name := case when coalesce(confirm, false) then 'appointment.confirmed.v1' else 'appointment.held.v1' end;
 if waitlist_entry is not null then
  update private.waitlist_entries w set state=case when coalesce(confirm, false) then 'accepted' else 'offered' end, appointment_id=aid, version=w.version+1 where w.id=waitlist_entry;
  perform private.agenda_emit(tenant, unit, case when coalesce(confirm, false) then 'waitlist.accepted.v1' else 'waitlist.offered.v1' end, waitlist_entry, entry.version+1,
   jsonb_build_object('waitlist_entry_id', waitlist_entry, 'appointment_id', aid, 'contract', 1), coalesce(confirm, false));
 end if;
 perform private.agenda_emit(tenant, unit, event_name, aid, 1, private.agenda_payload(tenant, aid, null), coalesce(confirm, false));
 result := private.agenda_payload(tenant, aid, null);
 return private.agenda_remember(tenant, 'reserve', key, hash, result);
end $$;

create function public.agenda_transition(tenant uuid, unit uuid, appointment uuid, expected_version integer, action text, idempotency_key text, reason text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare key text := private.agenda_key(idempotency_key); hash text; replay jsonb; a private.appointments; ids uuid[]; why text := coalesce(btrim(reason), ''); result jsonb; event_name text;
begin
 perform private.agenda_assert(tenant, unit, 'agenda.book');
 if action not in ('confirm','check_in','cancel','no_show') then raise exception 'Transição inválida' using errcode='22023'; end if;
 hash := pg_catalog.md5(concat_ws('|', tenant::text, unit::text, appointment::text, expected_version::text, action, why));
 replay := private.agenda_replay(tenant, 'transition', key, hash);
 if replay is not null then return replay; end if;
 select coalesce(array_agg(ar.resource_id order by ar.resource_id), '{}') into ids from private.appointment_resources ar where ar.tenant_id=tenant and ar.appointment_id=appointment;
 perform private.agenda_lock_resources(ids);
 select * into a from private.appointments x where x.tenant_id=tenant and x.id=appointment and x.unit_id=unit for update;
 if a.id is null then raise exception 'Agendamento indisponível' using errcode='42501'; end if;
 if a.version is distinct from expected_version then raise exception 'Versão desatualizada' using errcode='40001'; end if;
 if a.state='held' and a.hold_expires_at <= now() and action in ('confirm','check_in') then
  perform private.agenda_release_expired(ids, null);
  result := private.agenda_payload(tenant, appointment, 'A reserva temporária venceu e o horário foi liberado.');
  return private.agenda_remember(tenant, 'transition', key, hash, result);
 end if;
 if action='confirm' and a.state<>'held' then raise exception 'Só uma reserva temporária pode ser confirmada' using errcode='22023'; end if;
 if action='check_in' and a.state<>'confirmed' then raise exception 'Check-in exige agendamento confirmado' using errcode='22023'; end if;
 if action='no_show' and a.state<>'confirmed' then raise exception 'Falta só se registra em agendamento confirmado' using errcode='22023'; end if;
 if action='cancel' and a.state not in ('held','confirmed','checked_in') then raise exception 'Agendamento não pode ser cancelado neste estado' using errcode='22023'; end if;
 if action in ('cancel','no_show') and length(why) not between 1 and 500 then raise exception 'Informe o motivo' using errcode='22023'; end if;
 if action in ('cancel','no_show') then
  update private.resource_reservations rr set occupies=false where rr.tenant_id=tenant and rr.appointment_id=appointment and rr.occupies;
  update private.waitlist_entries w set state=case when w.state='offered' then 'waiting' else 'cancelled' end, appointment_id=case when w.state='offered' then null else w.appointment_id end, version=w.version+1
  where w.tenant_id=tenant and w.appointment_id=appointment and w.state in ('offered','accepted');
 end if;
 event_name := case action when 'confirm' then 'appointment.confirmed.v1' when 'check_in' then 'appointment.checked_in.v1' when 'cancel' then 'appointment.cancelled.v1' else 'appointment.no_show.v1' end;
 update private.appointments x set
  state=case action when 'confirm' then 'confirmed' when 'check_in' then 'checked_in' when 'cancel' then 'cancelled' else 'no_show' end,
  hold_expires_at=null, cancel_reason=case when action in ('cancel','no_show') then why else x.cancel_reason end,
  version=x.version+1, updated_at=now()
 where x.id=appointment;
 if action='confirm' then
  update private.waitlist_entries w set state='accepted', version=w.version+1 where w.tenant_id=tenant and w.appointment_id=appointment and w.state='offered';
 end if;
 perform private.agenda_emit(tenant, unit, event_name, appointment, expected_version+1, private.agenda_payload(tenant, appointment, null), action <> 'check_in');
 result := private.agenda_payload(tenant, appointment, null);
 return private.agenda_remember(tenant, 'transition', key, hash, result);
end $$;

create function public.agenda_reschedule(tenant uuid, unit uuid, appointment uuid, expected_version integer, local_start timestamp, resources uuid[], idempotency_key text, hold_minutes integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare key text := private.agenda_key(idempotency_key); hash text; replay jsonb; a private.appointments; old_ids uuid[]; slot jsonb; span tstzrange; msg text; mins integer := coalesce(hold_minutes, 10); result jsonb;
begin
 perform private.agenda_assert(tenant, unit, 'agenda.book');
 hash := pg_catalog.md5(concat_ws('|', tenant::text, unit::text, appointment::text, expected_version::text, local_start::text,
  coalesce((select string_agg(x::text, ',' order by x::text) from unnest(resources) x), ''), mins::text));
 replay := private.agenda_replay(tenant, 'reschedule', key, hash);
 if replay is not null then return replay; end if;
 if mins not between 1 and 30 then raise exception 'A reserva temporária deve durar de 1 a 30 minutos' using errcode='22023'; end if;
 select coalesce(array_agg(ar.resource_id order by ar.resource_id), '{}') into old_ids from private.appointment_resources ar where ar.tenant_id=tenant and ar.appointment_id=appointment;
 perform private.agenda_lock_resources(old_ids || resources);
 select * into a from private.appointments x where x.tenant_id=tenant and x.id=appointment and x.unit_id=unit for update;
 if a.id is null then raise exception 'Agendamento indisponível' using errcode='42501'; end if;
 if a.version is distinct from expected_version then raise exception 'Versão desatualizada' using errcode='40001'; end if;
 if a.state not in ('held','confirmed') then raise exception 'Só reserva temporária ou confirmada pode ser reagendada' using errcode='22023'; end if;
 if a.state='held' and a.hold_expires_at <= now() then
  perform private.agenda_release_expired(old_ids, null);
  result := private.agenda_payload(tenant, appointment, 'A reserva temporária venceu e o horário original foi liberado.');
  return private.agenda_remember(tenant, 'reschedule', key, hash, result);
 end if;
 slot := private.agenda_slot(tenant, unit, a.service_version_id, local_start, resources, false);
 span := tstzrange((slot->>'buffer_start')::timestamptz, (slot->>'buffer_end')::timestamptz, '[)');
 perform private.agenda_release_expired(resources, span);
 msg := private.agenda_conflict(tenant, resources, span, slot->>'timezone', appointment);
 if msg is not null then raise exception '%', msg using errcode='23P01'; end if;
 update private.resource_reservations rr set occupies=false where rr.tenant_id=tenant and rr.appointment_id=appointment and rr.occupies;
 delete from private.appointment_resources ar where ar.tenant_id=tenant and ar.appointment_id=appointment;
 perform private.agenda_occupy(tenant, appointment, unit, resources, (slot->>'buffer_start')::timestamptz, (slot->>'buffer_end')::timestamptz, slot->>'timezone');
 update private.appointments x set starts_at=(slot->>'starts_at')::timestamptz, ends_at=(slot->>'ends_at')::timestamptz,
  local_start=agenda_reschedule.local_start, local_end=(slot->>'local_end')::timestamp, timezone=slot->>'timezone',
  hold_expires_at=case when x.state='held' then now() + make_interval(mins => mins) else null end,
  version=x.version+1, updated_at=now() where x.id=appointment;
 perform private.agenda_emit(tenant, unit, 'appointment.rescheduled.v1', appointment, expected_version+1, private.agenda_payload(tenant, appointment, null), a.state='confirmed');
 result := private.agenda_payload(tenant, appointment, null);
 return private.agenda_remember(tenant, 'reschedule', key, hash, result);
end $$;

create function public.agenda_block(tenant uuid, unit uuid, resource uuid, local_start timestamp, local_end timestamp, reason text, idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare key text := private.agenda_key(idempotency_key); hash text; replay jsonb; tz text; a timestamptz; b timestamptz; why text := btrim(coalesce(reason, '')); bid uuid; msg text; result jsonb;
begin
 perform private.agenda_assert(tenant, unit, 'agenda.book');
 hash := pg_catalog.md5(concat_ws('|', tenant::text, unit::text, resource::text, local_start::text, local_end::text, why));
 replay := private.agenda_replay(tenant, 'block', key, hash);
 if replay is not null then return replay; end if;
 if length(why) not between 1 and 500 then raise exception 'Informe o motivo do bloqueio' using errcode='22023'; end if;
 if not exists (select 1 from private.catalog_resources r join private.catalog_resource_units ru on ru.tenant_id=r.tenant_id and ru.resource_id=r.id
  where r.tenant_id=tenant and r.id=resource and ru.unit_id=unit and r.active) then raise exception 'Recurso indisponível na unidade' using errcode='22023'; end if;
 select un.timezone into tz from public.units un where un.tenant_id=tenant and un.id=unit;
 a := local_start at time zone tz; b := local_end at time zone tz;
 if local_start is null or local_end is null or local_end <= local_start or b <= a or local_end - local_start > interval '31 days' or a at time zone tz <> local_start or b at time zone tz <> local_end then
  raise exception 'Intervalo local inválido' using errcode='22023'; end if;
 perform private.agenda_lock_resources(array[resource]);
 perform private.agenda_release_expired(array[resource], tstzrange(a, b, '[)'));
 msg := private.agenda_conflict(tenant, array[resource], tstzrange(a, b, '[)'), tz, null);
 if msg is not null then raise exception '%', msg using errcode='23P01'; end if;
 insert into private.agenda_blocks(tenant_id, unit_id, resource_id, period, timezone, local_start, local_end, reason, created_by)
 values (tenant, unit, resource, tstzrange(a, b, '[)'), tz, local_start, local_end, why, auth.uid()) returning id into bid;
 begin
  insert into private.resource_reservations(tenant_id, resource_id, unit_id, period, occupies, block_id) values (tenant, resource, unit, tstzrange(a, b, '[)'), true, bid);
 exception when exclusion_violation then
  raise exception '%', format('Conflito de reserva: o recurso está ocupado entre %s e %s. Escolha outro horário.', to_char(a at time zone tz, 'YYYY-MM-DD HH24:MI'), to_char(b at time zone tz, 'YYYY-MM-DD HH24:MI')) using errcode='23P01';
 end;
 perform private.agenda_emit(tenant, unit, 'agenda.block.created.v1', bid, 1, jsonb_build_object('block_id', bid, 'resource_id', resource, 'contract', 1), false);
 result := jsonb_build_object('block_id', bid, 'version', 1, 'local_start', local_start, 'local_end', local_end, 'timezone', tz, 'active', true, 'contract', 1);
 return private.agenda_remember(tenant, 'block', key, hash, result);
end $$;

create function public.agenda_release_block(tenant uuid, unit uuid, block uuid, expected_version integer, idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare key text := private.agenda_key(idempotency_key); hash text; replay jsonb; b private.agenda_blocks; result jsonb;
begin
 perform private.agenda_assert(tenant, unit, 'agenda.book');
 hash := pg_catalog.md5(concat_ws('|', tenant::text, unit::text, block::text, expected_version::text));
 replay := private.agenda_replay(tenant, 'release_block', key, hash);
 if replay is not null then return replay; end if;
 perform private.agenda_lock_resources(array(select resource_id from private.agenda_blocks where tenant_id=tenant and id=block));
 select * into b from private.agenda_blocks x where x.tenant_id=tenant and x.id=block and x.unit_id=unit for update;
 if b.id is null then raise exception 'Bloqueio indisponível' using errcode='42501'; end if;
 if b.version is distinct from expected_version then raise exception 'Versão desatualizada' using errcode='40001'; end if;
 update private.agenda_blocks x set active=false, version=x.version+1 where x.id=block;
 update private.resource_reservations rr set occupies=false where rr.tenant_id=tenant and rr.block_id=block and rr.occupies;
 perform private.agenda_emit(tenant, unit, 'agenda.block.released.v1', block, expected_version+1, jsonb_build_object('block_id', block, 'resource_id', b.resource_id, 'contract', 1), false);
 result := jsonb_build_object('block_id', block, 'version', expected_version+1, 'active', false, 'contract', 1);
 return private.agenda_remember(tenant, 'release_block', key, hash, result);
end $$;

create function public.agenda_waitlist_join(tenant uuid, unit uuid, client uuid, version_id uuid, windows jsonb, idempotency_key text, professionals uuid[] default '{}', priority integer default 50, notes text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare key text := private.agenda_key(idempotency_key); hash text; replay jsonb; v private.catalog_service_versions; current_version integer; tz text; item jsonb; a timestamp; b timestamp; aa timestamptz; bb timestamptz; eid uuid; rid uuid; note text := coalesce(btrim(notes), ''); rank integer := coalesce(priority, 50); result jsonb;
begin
 perform private.agenda_assert(tenant, unit, 'agenda.book');
 hash := pg_catalog.md5(concat_ws('|', tenant::text, unit::text, client::text, version_id::text, windows::text, coalesce((select string_agg(x::text, ',' order by x::text) from unnest(professionals) x), ''), rank::text, note));
 replay := private.agenda_replay(tenant, 'waitlist_join', key, hash);
 if replay is not null then return replay; end if;
 if rank not between 1 and 100 or length(note) > 500 then raise exception 'Prioridade ou observação inválida' using errcode='22023'; end if;
 if jsonb_typeof(windows) is distinct from 'array' or jsonb_array_length(windows) not between 1 and 14 then raise exception 'Informe de 1 a 14 janelas' using errcode='22023'; end if;
 if not exists (select 1 from private.clients c where c.tenant_id=tenant and c.unit_id=unit and c.id=client and c.state='active') then raise exception 'Cliente indisponível nesta unidade' using errcode='22023'; end if;
 select sv.* into v from private.catalog_service_versions sv where sv.tenant_id=tenant and sv.id=version_id;
 select s.current_version into current_version from private.catalog_services s where s.tenant_id=tenant and s.id=v.service_id;
 if v.id is null or v.version is distinct from current_version or v.state <> 'published' then raise exception 'Versão não disponível para nova reserva' using errcode='22023'; end if;
 if not exists (select 1 from private.catalog_service_units su where su.tenant_id=tenant and su.version_id=v.id and su.unit_id=unit) then raise exception 'Serviço indisponível nesta unidade' using errcode='22023'; end if;
 select un.timezone into tz from public.units un where un.tenant_id=tenant and un.id=unit;
 if professionals is not null then
  foreach rid in array professionals loop
   if not exists (select 1 from private.catalog_resources r join private.catalog_service_resources sr on sr.tenant_id=r.tenant_id and sr.resource_id=r.id and sr.version_id=v.id and sr.unit_id=unit
    where r.tenant_id=tenant and r.id=rid and r.kind='professional' and r.active) then raise exception 'Profissional aceito não está habilitado' using errcode='22023'; end if;
  end loop;
 end if;
 insert into private.waitlist_entries(tenant_id, unit_id, client_id, service_id, service_version_id, priority, notes, created_by)
 values (tenant, unit, client, v.service_id, version_id, rank, note, auth.uid()) returning id into eid;
 for item in select value from jsonb_array_elements(windows) loop
  a := (item->>'local_start')::timestamp; b := (item->>'local_end')::timestamp;
  aa := a at time zone tz; bb := b at time zone tz;
  if a is null or b is null or b <= a or bb <= aa or b - a > interval '31 days' or aa at time zone tz <> a or bb at time zone tz <> b then raise exception 'Janela local inválida' using errcode='22023'; end if;
  insert into private.waitlist_windows(tenant_id, entry_id, period, timezone, local_start, local_end) values (tenant, eid, tstzrange(aa, bb, '[)'), tz, a, b);
 end loop;
 if professionals is not null then
  insert into private.waitlist_professionals(tenant_id, entry_id, resource_id) select tenant, eid, x from unnest(professionals) x;
 end if;
 perform private.agenda_emit(tenant, unit, 'waitlist.joined.v1', eid, 1, jsonb_build_object('waitlist_entry_id', eid, 'client_id', client, 'service_version_id', version_id, 'contract', 1), false);
 result := jsonb_build_object('waitlist_entry_id', eid, 'state', 'waiting', 'version', 1, 'priority', rank, 'contract', 1);
 return private.agenda_remember(tenant, 'waitlist_join', key, hash, result);
end $$;

create function public.agenda_waitlist_cancel(tenant uuid, unit uuid, entry uuid, expected_version integer, idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare key text := private.agenda_key(idempotency_key); hash text; replay jsonb; w private.waitlist_entries; result jsonb;
begin
 perform private.agenda_assert(tenant, unit, 'agenda.book');
 hash := pg_catalog.md5(concat_ws('|', tenant::text, unit::text, entry::text, expected_version::text));
 replay := private.agenda_replay(tenant, 'waitlist_cancel', key, hash);
 if replay is not null then return replay; end if;
 select * into w from private.waitlist_entries x where x.tenant_id=tenant and x.id=entry and x.unit_id=unit for update;
 if w.id is null then raise exception 'Encaixe indisponível' using errcode='42501'; end if;
 if w.version is distinct from expected_version then raise exception 'Versão desatualizada' using errcode='40001'; end if;
 if w.state not in ('waiting','offered') then raise exception 'Encaixe não pode ser cancelado neste estado' using errcode='22023'; end if;
 if w.state='offered' and w.appointment_id is not null then
  update private.resource_reservations rr set occupies=false where rr.appointment_id=w.appointment_id and rr.occupies;
  update private.appointments a set state='cancelled', hold_expires_at=null, cancel_reason='Oferta de encaixe cancelada', version=a.version+1, updated_at=now()
  where a.tenant_id=tenant and a.id=w.appointment_id and a.state='held';
  perform private.agenda_emit(tenant, unit, 'appointment.cancelled.v1', w.appointment_id, (select version from private.appointments where id=w.appointment_id), private.agenda_payload(tenant, w.appointment_id, null), true);
 end if;
 update private.waitlist_entries x set state='cancelled', appointment_id=null, version=x.version+1 where x.id=entry;
 perform private.agenda_emit(tenant, unit, 'waitlist.cancelled.v1', entry, expected_version+1, jsonb_build_object('waitlist_entry_id', entry, 'contract', 1), false);
 result := jsonb_build_object('waitlist_entry_id', entry, 'state', 'cancelled', 'version', expected_version+1, 'contract', 1);
 return private.agenda_remember(tenant, 'waitlist_cancel', key, hash, result);
end $$;

create function public.agenda_waitlist(tenant uuid, unit uuid, version_id uuid default null, local_start timestamp default null, local_end timestamp default null, professional uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; a timestamptz; b timestamptz; begin
 perform private.agenda_assert(tenant, unit, 'agenda.read');
 select un.timezone into tz from public.units un where un.tenant_id=tenant and un.id=unit;
 if local_start is not null or local_end is not null then
  if local_start is null or local_end is null or local_end <= local_start then raise exception 'Informe o intervalo local completo' using errcode='22023'; end if;
  a := local_start at time zone tz; b := local_end at time zone tz;
  if a at time zone tz <> local_start or b at time zone tz <> local_end then raise exception 'Horário local inválido no fuso da unidade' using errcode='22023'; end if;
 end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.priority desc, x.created_at, x.id) from (
  select w.id, w.client_id, c.name as client_name, w.service_version_id, v.name as service_name, w.priority, w.state, w.version, w.notes, w.appointment_id, w.created_at,
   (select coalesce(jsonb_agg(wp.resource_id), '[]'::jsonb) from private.waitlist_professionals wp where wp.tenant_id=w.tenant_id and wp.entry_id=w.id) professionals,
   (select coalesce(jsonb_agg(jsonb_build_object('local_start', ww.local_start, 'local_end', ww.local_end)), '[]'::jsonb) from private.waitlist_windows ww where ww.tenant_id=w.tenant_id and ww.entry_id=w.id) windows
  from private.waitlist_entries w
  join private.clients c on c.tenant_id=w.tenant_id and c.unit_id=w.unit_id and c.id=w.client_id
  join private.catalog_service_versions v on v.tenant_id=w.tenant_id and v.id=w.service_version_id
  where w.tenant_id=tenant and w.unit_id=unit and w.state='waiting'
  and (version_id is null or w.service_version_id=version_id)
  and (a is null or exists (select 1 from private.waitlist_windows ww where ww.tenant_id=w.tenant_id and ww.entry_id=w.id and ww.period @> tstzrange(a, b, '[)')))
  and (professional is null or not exists (select 1 from private.waitlist_professionals wp where wp.tenant_id=w.tenant_id and wp.entry_id=w.id)
   or exists (select 1 from private.waitlist_professionals wp where wp.tenant_id=w.tenant_id and wp.entry_id=w.id and wp.resource_id=professional))
  order by w.priority desc, w.created_at, w.id limit 30) x), '[]'::jsonb);
end $$;

create function public.agenda_grid(tenant uuid, unit uuid, local_day date, span text default 'day') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; origin date; finish date; range_start timestamptz; range_end timestamptz; begin
 perform private.agenda_assert(tenant, unit, 'agenda.read');
 if local_day is null or span not in ('day','week') then raise exception 'Período inválido' using errcode='22023'; end if;
 select un.timezone into tz from public.units un where un.tenant_id=tenant and un.id=unit and un.active;
 if tz is null then raise exception 'Unidade indisponível' using errcode='42501'; end if;
 origin := case when span='week' then local_day - (extract(isodow from local_day)::integer - 1) else local_day end;
 finish := origin + case when span='week' then 7 else 1 end;
 range_start := origin::timestamp at time zone tz; range_end := finish::timestamp at time zone tz;
 return jsonb_build_object('timezone', tz, 'from', origin, 'to', finish, 'span', span,
  'resources', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'kind', r.kind, 'location', ru.location) order by r.kind, r.name)
   from private.catalog_resources r join private.catalog_resource_units ru on ru.tenant_id=r.tenant_id and ru.resource_id=r.id and ru.unit_id=unit
   where r.tenant_id=tenant and r.active), '[]'::jsonb),
  'appointments', coalesce((select jsonb_agg(jsonb_build_object(
    'id', a.id, 'state', a.state, 'version', a.version, 'local_start', a.local_start, 'local_end', a.local_end,
    'starts_at', a.starts_at, 'ends_at', a.ends_at, 'timezone', a.timezone, 'hold_expires_at', a.hold_expires_at,
    'client_id', a.client_id, 'client_name', c.name, 'service_version_id', a.service_version_id, 'service_name', v.name,
    'waitlist_entry_id', a.waitlist_entry_id,
    'resource_ids', (select coalesce(jsonb_agg(ar.resource_id order by ar.resource_id), '[]'::jsonb) from private.appointment_resources ar where ar.tenant_id=a.tenant_id and ar.appointment_id=a.id)
   ) order by a.starts_at, a.id)
   from private.appointments a
   join private.clients c on c.tenant_id=a.tenant_id and c.unit_id=a.unit_id and c.id=a.client_id
   join private.catalog_service_versions v on v.tenant_id=a.tenant_id and v.id=a.service_version_id
   where a.tenant_id=tenant and a.unit_id=unit and a.state <> 'expired' and a.starts_at < range_end and a.ends_at > range_start), '[]'::jsonb),
  'blocks', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'resource_id', b.resource_id, 'unit_id', b.unit_id, 'local_start', b.local_start, 'local_end', b.local_end, 'timezone', b.timezone, 'reason', b.reason, 'version', b.version) order by lower(b.period), b.id)
   from private.agenda_blocks b
   where b.tenant_id=tenant and b.active and b.period && tstzrange(range_start, range_end, '[)')
   and exists (select 1 from private.catalog_resource_units ru where ru.tenant_id=b.tenant_id and ru.resource_id=b.resource_id and ru.unit_id=unit)), '[]'::jsonb));
end $$;

create function public.agenda_availability(tenant uuid, unit uuid, version_id uuid, local_start timestamp) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v private.catalog_service_versions; current_version integer; tz text; local_end timestamp; a timestamptz; b timestamptz; ba timestamptz; bb timestamptz; begin
 perform private.agenda_assert(tenant, unit, 'agenda.read');
 select sv.* into v from private.catalog_service_versions sv where sv.tenant_id=tenant and sv.id=version_id;
 select s.current_version into current_version from private.catalog_services s where s.tenant_id=tenant and s.id=v.service_id;
 if v.id is null or v.version is distinct from current_version or v.state <> 'published' then raise exception 'Versão não disponível para nova reserva' using errcode='22023'; end if;
 if not exists (select 1 from private.catalog_service_units su where su.tenant_id=tenant and su.version_id=v.id and su.unit_id=unit) then raise exception 'Serviço indisponível nesta unidade' using errcode='22023'; end if;
 select un.timezone into tz from public.units un where un.tenant_id=tenant and un.id=unit;
 local_end := local_start + make_interval(mins => v.duration_minutes);
 a := local_start at time zone tz; b := local_end at time zone tz;
 if local_start is null or b <= a or a at time zone tz <> local_start or b at time zone tz <> local_end then raise exception 'Horário local inválido no fuso da unidade' using errcode='22023'; end if;
 ba := a - make_interval(mins => v.buffer_before); bb := b + make_interval(mins => v.buffer_after);
 return jsonb_build_object('timezone', tz, 'local_start', local_start, 'local_end', local_end, 'buffer_local_start', ba at time zone tz, 'buffer_local_end', bb at time zone tz,
  'resources', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'kind', r.kind, 'location', ru.location, 'capacity', ru.capacity, 'available',
    exists (select 1 from private.catalog_windows w where w.tenant_id=tenant and w.resource_id=r.id and w.unit_id=unit and w.kind in ('shift','exception') and w.period @> tstzrange(ba, bb, '[)'))
    and not exists (select 1 from private.catalog_windows w where w.tenant_id=tenant and w.resource_id=r.id and w.kind in ('off','holiday') and w.period && tstzrange(ba, bb, '[)'))
    and not exists (select 1 from private.resource_reservations rr left join private.appointments ap on ap.tenant_id=rr.tenant_id and ap.id=rr.appointment_id
     where rr.tenant_id=tenant and rr.resource_id=r.id and rr.occupies and rr.period && tstzrange(ba, bb, '[)')
     and (ap.id is null or ap.state <> 'held' or ap.hold_expires_at > now())),
    'reason', case
     when not exists (select 1 from private.catalog_windows w where w.tenant_id=tenant and w.resource_id=r.id and w.unit_id=unit and w.kind in ('shift','exception') and w.period @> tstzrange(ba, bb, '[)')) then 'sem jornada'
     when exists (select 1 from private.catalog_windows w where w.tenant_id=tenant and w.resource_id=r.id and w.kind in ('off','holiday') and w.period && tstzrange(ba, bb, '[)')) then 'folga ou feriado'
     when exists (select 1 from private.resource_reservations rr left join private.appointments ap on ap.tenant_id=rr.tenant_id and ap.id=rr.appointment_id
      where rr.tenant_id=tenant and rr.resource_id=r.id and rr.occupies and rr.period && tstzrange(ba, bb, '[)') and (ap.id is null or ap.state <> 'held' or ap.hold_expires_at > now())) then 'ocupado'
     else 'livre' end
   ) order by r.kind, r.name)
   from private.catalog_resources r join private.catalog_resource_units ru on ru.tenant_id=r.tenant_id and ru.resource_id=r.id and ru.unit_id=unit
   where r.tenant_id=tenant and r.active
   and (r.membership_id is null or exists (select 1 from public.tenant_memberships m join public.membership_units mu on mu.tenant_id=m.tenant_id and mu.membership_id=m.id
    where m.tenant_id=tenant and m.id=r.membership_id and m.status='active' and mu.unit_id=unit))
   and (r.kind='professional' and exists (select 1 from private.catalog_service_resources sr where sr.tenant_id=tenant and sr.version_id=agenda_availability.version_id and sr.unit_id=unit and sr.resource_id=r.id)
    or (r.kind <> 'professional' and (exists (select 1 from private.catalog_service_resources sr where sr.tenant_id=tenant and sr.version_id=agenda_availability.version_id and sr.unit_id=unit and sr.resource_id=r.id)
     or (exists (select 1 from private.catalog_requirements q where q.tenant_id=tenant and q.version_id=agenda_availability.version_id and q.kind=r.kind and q.capability = any(r.capabilities) and ru.capacity >= q.quantity)
      and not exists (select 1 from private.catalog_service_resources sr join private.catalog_resources cr on cr.tenant_id=sr.tenant_id and cr.id=sr.resource_id
       where sr.tenant_id=tenant and sr.version_id=agenda_availability.version_id and sr.unit_id=unit and cr.kind=r.kind)))))
  ), '[]'::jsonb));
end $$;

create function public.agenda_openings(tenant uuid, unit uuid, version_id uuid, local_day date, resources uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare gs timestamp; slot jsonb; found jsonb := '[]'::jsonb; begin
 perform private.agenda_assert(tenant, unit, 'agenda.read');
 if local_day is null then raise exception 'Informe o dia' using errcode='22023'; end if;
 for gs in select g from generate_series(local_day::timestamp, local_day::timestamp + interval '1 day' - interval '15 minutes', interval '15 minutes') g loop
  begin
   slot := private.agenda_slot(tenant, unit, version_id, gs, resources, true);
  exception when sqlstate '22023' then continue; end;
  if private.agenda_conflict(tenant, resources, tstzrange((slot->>'buffer_start')::timestamptz, (slot->>'buffer_end')::timestamptz, '[)'), slot->>'timezone', null) is null then
   found := found || jsonb_build_array(to_char(gs, 'YYYY-MM-DD"T"HH24:MI'));
   if jsonb_array_length(found) >= 12 then exit; end if;
  end if;
 end loop;
 return found;
end $$;

create function public.expire_agenda_holds(tenant uuid, unit uuid) returns integer
language plpgsql security definer set search_path='' as $$ declare n integer; begin
 perform private.agenda_assert(tenant, unit, 'agenda.book');
 select count(*)::integer into n from private.appointments a where a.tenant_id=tenant and a.unit_id=unit and a.state='held' and a.hold_expires_at <= now();
 perform private.agenda_release_expired(
  array(select distinct ar.resource_id from private.appointment_resources ar join private.appointments a on a.tenant_id=ar.tenant_id and a.id=ar.appointment_id
   where a.tenant_id=tenant and a.unit_id=unit and a.state='held' and a.hold_expires_at <= now()), null);
 return n;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure sig, n.nspname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='public' and p.proname in ('agenda_reserve','agenda_transition','agenda_reschedule','agenda_block','agenda_release_block','agenda_waitlist_join','agenda_waitlist_cancel','agenda_waitlist','agenda_grid','agenda_availability','agenda_openings','expire_agenda_holds'))
  or (n.nspname='private' and p.proname in ('agenda_assert','agenda_key','agenda_emit','agenda_payload','agenda_lock_resources','agenda_release_expired','expire_agenda_holds_job','agenda_conflict','agenda_slot','agenda_occupy','agenda_replay','agenda_remember')) loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', f.sig);
  if f.nspname='public' then execute format('grant execute on function %s to authenticated', f.sig); end if;
 end loop;
end $$;

-- Limpeza de apoio. Sem a extensão, expire_agenda_holds e as RPCs de escrita continuam válidas.
do $cron$ begin
 if exists (select 1 from pg_extension where extname='pg_cron') then
  if exists (select 1 from cron.job where jobname='zetta-expire-agenda-holds') then
   perform cron.unschedule('zetta-expire-agenda-holds');
  end if;
  perform cron.schedule('zetta-expire-agenda-holds', '*/5 * * * *', 'select private.expire_agenda_holds_job()');
 end if;
exception when undefined_table or undefined_function or invalid_schema_name then null;
end $cron$;
