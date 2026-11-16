-- Somente dados sintéticos. Usuários são criados pela API Auth em scripts/seed-local.mjs.
insert into public.tenants(id,slug,name) values
 ('10000000-0000-0000-0000-000000000001','clinica-aurora','Clínica Aurora • demonstração'),
 ('20000000-0000-0000-0000-000000000001','clinica-horizonte','Clínica Horizonte • demonstração') on conflict do nothing;
insert into public.units(id,tenant_id,name) values
 ('10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','Aurora • Centro'),
 ('10000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','Aurora • Unidade restrita'),
 ('20000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000001','Horizonte • Centro') on conflict do nothing;
insert into public.tenant_entitlements(tenant_id,module_key) select id,'core' from public.tenants on conflict do nothing;
insert into public.tenant_memberships(tenant_id,user_id,role,status)
select t.id,u.id, case when u.email in ('a@example.com','b@example.com') then 'clinic_admin' else 'manager' end,
 case when u.email='revogado@example.com' then 'revoked' else 'active' end
from public.tenants t cross join auth.users u where
 (t.slug='clinica-aurora' and u.email in ('a@example.com','multi@example.com','revogado@example.com')) or
 (t.slug='clinica-horizonte' and u.email in ('b@example.com','multi@example.com'))
on conflict(tenant_id,user_id) do update set status=excluded.status,role=excluded.role;
insert into public.membership_units(tenant_id,membership_id,unit_id)
select m.tenant_id,m.id,u.id from public.tenant_memberships m join public.units u on u.tenant_id=m.tenant_id
where u.id::text in ('10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011') on conflict do nothing;
-- Prompt 02: plano A completo, B essencial; fixtures explicitamente sintéticas.
insert into public.tenant_subscriptions(tenant_id,plan_key,state)
select id,case when slug='clinica-aurora' then 'complete' else 'essential' end,'active' from public.tenants where slug in ('clinica-aurora','clinica-horizonte') on conflict do nothing;
insert into public.tenant_configuration(tenant_id,brand,responsible_name)
select id,name,'Responsável sintético' from public.tenants where slug in ('clinica-aurora','clinica-horizonte') on conflict do nothing;
insert into public.tenant_connections(tenant_id) select tenant_id from public.tenant_configuration on conflict do nothing;
insert into public.tenant_entitlements(tenant_id,module_key)
select s.tenant_id,pm.module_key from public.tenant_subscriptions s join public.plan_modules pm on pm.plan_key=s.plan_key on conflict do nothing;
insert into public.module_test_records(tenant_id,unit_id,module_key)
select tenant_id,id,k from public.units cross join unnest(array['agenda','packages']) k on conflict do nothing;

-- Console sintético: papel global privado, sem vínculo operacional nas clínicas.
insert into private.platform_memberships(user_id,role)
select id,'superadmin' from auth.users where email='zetta@example.com' on conflict do nothing;

-- Prompt 06: catálogo explicitamente sintético para preparar a agenda (sem reservas).
insert into private.catalog_resources(id,tenant_id,kind,name,qualification,capabilities)
select (left(t.id::text,24)||r.suffix)::uuid,t.id,r.kind,r.name,'Demonstração operacional; validar qualificação real',array['avaliacao']
from public.tenants t cross join (values
 ('000000000101','professional','Profissional de avaliação · exemplo'),
 ('000000000102','room','Sala de avaliação · exemplo'),
 ('000000000103','equipment','Equipamento de avaliação · exemplo')) r(suffix,kind,name)
where t.slug in ('clinica-aurora','clinica-horizonte') on conflict do nothing;
insert into private.catalog_resource_units(tenant_id,resource_id,unit_id,location,capacity)
select r.tenant_id,r.id,u.id,case when r.kind='room' then 'Sala 01' when r.kind='equipment' then 'Armário 01 · móvel' else 'Atendimento' end,1
from private.catalog_resources r join public.units u on u.tenant_id=r.tenant_id
where right(r.id::text,12) in ('000000000101','000000000102','000000000103') and (right(u.id::text,12)='000000000011' or r.kind='professional') on conflict do nothing;
insert into private.catalog_services(id,tenant_id,current_version)
select (left(id::text,24)||'000000000201')::uuid,id,1 from public.tenants where slug in ('clinica-aurora','clinica-horizonte') on conflict do nothing;
insert into private.catalog_service_versions(id,tenant_id,service_id,version,name,category,duration_minutes,buffer_before,buffer_after,price_cents,currency,preparation,state,created_by)
select (left(s.tenant_id::text,24)||'000000000211')::uuid,s.tenant_id,s.id,1,'Avaliação estética · exemplo','Avaliação',30,5,10,15000,'BRL','Confirmar cadastro e orientar chegada com 10 minutos de antecedência.','published',u.id
from private.catalog_services s join public.tenant_memberships m on m.tenant_id=s.tenant_id and m.role='clinic_admin' join auth.users u on u.id=m.user_id
where right(s.id::text,12)='000000000201' and u.email in ('a@example.com','b@example.com') on conflict do nothing;
insert into private.catalog_service_units(tenant_id,version_id,unit_id)
select v.tenant_id,v.id,u.id from private.catalog_service_versions v join public.units u on u.tenant_id=v.tenant_id where right(v.id::text,12)='000000000211' and right(u.id::text,12)='000000000011' on conflict do nothing;
insert into private.catalog_service_resources(tenant_id,version_id,unit_id,resource_id)
select su.tenant_id,su.version_id,su.unit_id,ru.resource_id from private.catalog_service_units su join private.catalog_resource_units ru on ru.tenant_id=su.tenant_id and ru.unit_id=su.unit_id
where right(su.version_id::text,12)='000000000211' and right(ru.resource_id::text,12) in ('000000000101','000000000102','000000000103') on conflict do nothing;
insert into private.catalog_requirements(tenant_id,version_id,kind,capability,quantity)
select tenant_id,id,k,'avaliacao',1 from private.catalog_service_versions cross join unnest(array['room','equipment']) k where right(id::text,12)='000000000211' on conflict do nothing;
insert into private.catalog_windows(id,tenant_id,resource_id,unit_id,kind,period,timezone,local_start,local_end,reason)
select (left(ru.tenant_id::text,24)||case when right(ru.unit_id::text,12)='000000000012' then '000000000304' else case r.kind when 'professional' then '000000000301' when 'room' then '000000000302' else '000000000303' end end)::uuid,
ru.tenant_id,ru.resource_id,ru.unit_id,'shift',tstzrange(d.a at time zone u.timezone,d.b at time zone u.timezone,'[)'),u.timezone,d.a,d.b,'Jornada sintética por data; sem reservas'
from private.catalog_resource_units ru join private.catalog_resources r on r.tenant_id=ru.tenant_id and r.id=ru.resource_id join public.units u on u.tenant_id=ru.tenant_id and u.id=ru.unit_id
cross join lateral(select case when right(ru.unit_id::text,12)='000000000012' then '2026-11-16 13:00'::timestamp else '2026-11-16 09:00'::timestamp end a,case when right(ru.unit_id::text,12)='000000000012' then '2026-11-16 17:00'::timestamp else '2026-11-16 12:00'::timestamp end b) d
where right(r.id::text,12) in ('000000000101','000000000102','000000000103') on conflict do nothing;

-- Prompt 07: um horário confirmado de demonstração em cada clínica, sem conta FLW.
insert into private.clients(id,tenant_id,unit_id,name,phone_e164)
select (left(t.id::text,24)||'000000000401')::uuid,t.id,u.id,'Mariana · exemplo','+551198765401'||right(t.id::text,1)
from public.tenants t join public.units u on u.tenant_id=t.id
where t.slug in ('clinica-aurora','clinica-horizonte') and right(u.id::text,12)='000000000011'
on conflict do nothing;
insert into private.appointments(id,tenant_id,unit_id,client_id,service_id,service_version_id,state,starts_at,ends_at,timezone,local_start,local_end,created_by)
select (left(v.tenant_id::text,24)||'000000000501')::uuid,v.tenant_id,u.id,c.id,v.service_id,v.id,'confirmed',
 '2026-11-16 10:00'::timestamp at time zone u.timezone,'2026-11-16 10:30'::timestamp at time zone u.timezone,u.timezone,
 '2026-11-16 10:00','2026-11-16 10:30',m.user_id
from private.catalog_service_versions v
join public.units u on u.tenant_id=v.tenant_id and right(u.id::text,12)='000000000011'
join private.clients c on c.tenant_id=v.tenant_id and c.unit_id=u.id and right(c.id::text,12)='000000000401'
join public.tenant_memberships m on m.tenant_id=v.tenant_id and m.role='clinic_admin' and m.status='active'
where right(v.id::text,12)='000000000211'
on conflict do nothing;
insert into private.appointment_resources(tenant_id,appointment_id,resource_id,unit_id)
select a.tenant_id,a.id,r.id,a.unit_id
from private.appointments a join private.catalog_resources r on r.tenant_id=a.tenant_id
where right(a.id::text,12)='000000000501' and right(r.id::text,12) in ('000000000101','000000000102','000000000103')
on conflict do nothing;
insert into private.resource_reservations(tenant_id,resource_id,unit_id,period,occupies,appointment_id)
select a.tenant_id,ar.resource_id,a.unit_id,tstzrange(a.starts_at-interval '5 minutes',a.ends_at+interval '10 minutes','[)'),true,a.id
from private.appointments a join private.appointment_resources ar on ar.tenant_id=a.tenant_id and ar.appointment_id=a.id
where right(a.id::text,12)='000000000501'
and not exists (select 1 from private.resource_reservations rr where rr.appointment_id=a.id and rr.resource_id=ar.resource_id);
