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
