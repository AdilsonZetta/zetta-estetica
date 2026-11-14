begin;
set local search_path=public,extensions;
select no_plan();
create temp table audit_before as select coalesce(max(id),0) id from public.audit_logs;
select set_config('request.jwt.claims',json_build_object('sub',(select id from auth.users where email='zetta@example.com'),'role','authenticated')::text,true);
set local role authenticated;
create temp table review_tenant as select public.provision_tenant(gen_random_uuid(),'review-'||gen_random_uuid(),'Revisão','Centro','Marca','Responsável','review@example.com','essential') id;
select lives_ok($$select public.set_tenant_status((select id from review_tenant),true,'Teste suspensão')$$,'Suspende fixture');
select throws_ok($$select public.set_tenant_status((select id from review_tenant),null,'Teste estado nulo')$$,'22023','Estado obrigatório','Estado nulo é recusado');
select is((select t->>'status' from jsonb_array_elements(public.console_snapshot()->'tenants') t where t->>'id'=(select id::text from review_tenant)),'suspended','Estado nulo não reativa empresa');
select lives_ok($$select public.set_tenant_status((select id from review_tenant),false,'Teste reativação')$$,'Reativa fixture');
select throws_ok($$select public.set_tenant_status(gen_random_uuid(),false,'Teste inexistente')$$,'22023','Empresa inexistente','Estado exige empresa existente');
select throws_ok($$select public.update_onboarding(gen_random_uuid(),'pilot','Marca','Pessoa','Teste inexistente')$$,'22023','Empresa inexistente','Onboarding exige empresa existente');
select throws_ok($$select public.update_subscription(gen_random_uuid(),'active',null,'Teste inexistente')$$,'22023','Empresa inexistente','Assinatura exige empresa existente');
select throws_ok($$select public.set_tenant_plan(gen_random_uuid(),'essential','Teste inexistente')$$,'22023','Empresa inexistente','Plano exige empresa existente');
select throws_ok($$select public.test_connection(gen_random_uuid())$$,'22023','Empresa inexistente','Conexão exige empresa existente');
select throws_ok($$select public.configure_icon(gen_random_uuid(),'Conta teste','https://example.com')$$,'22023','Empresa inexistente','Ícone exige empresa existente');
select throws_ok($$select public.set_module_override(gen_random_uuid(),'agenda',true,now()+interval '1 day','Teste inexistente')$$,'22023','Empresa inexistente','Override exige empresa existente');
select lives_ok($$select public.grant_support((select id from review_tenant),auth.uid(),'diagnostics',15,'Motivo sintético da revisão')$$,'Concede diagnóstico');
select is((public.support_diagnostics((select id from review_tenant))->>'pending_deliveries')::int,1,'Conta convite vigente sem fila');
select lives_ok($$select public.request_invitation_delivery((select (t->'invitations'->0->>'id')::uuid from jsonb_array_elements(public.console_snapshot()->'tenants') t where t->>'id'=(select id::text from review_tenant)))$$,'Enfileira convite');
select is((public.support_diagnostics((select id from review_tenant))->>'pending_deliveries')::int,1,'Fila não duplica contagem');
reset role;
update public.tenant_invitations set expires_at=now()-interval '1 second' where tenant_id=(select id from review_tenant);
set local role authenticated;
select is((public.support_diagnostics((select id from review_tenant))->>'pending_deliveries')::int,0,'Convite expirado não conta como pendência');
select lives_ok($$select public.revoke_support(id) from public.support_grants where tenant_id=(select id from review_tenant)$$,'Revoga concessão');
reset role;
select ok(exists(select 1 from public.audit_logs where tenant_id=(select id from review_tenant) and action='support_granted' and details->>'scope'='diagnostics' and details->>'reason'='Motivo sintético da revisão' and details ?& array['grantee','approver','expires_at','minutes']),'Auditoria da concessão inclui contexto');
select ok(exists(select 1 from public.audit_logs where tenant_id=(select id from review_tenant) and action='support_revoked' and details->>'scope'='diagnostics' and details ?& array['grantee','approver','expires_at','reason','revoked_at']),'Auditoria da revogação inclui contexto');
select is((select count(*)::int from public.audit_logs where id>(select id from audit_before) and action in ('reactivate','onboarding','subscription','plan') and tenant_id not in (select id from public.tenants)),0,'Sem eventos fantasmas');
set local role authenticated;
-- Cada campo obrigatório é testado pela sessão administrativa, sem escrita parcial.
select throws_ok(format('select public.provision_tenant(gen_random_uuid(),%L,%L,%L,%L,%L,%L,%L)',v.slug,v.name,v.unit_name,v.brand,v.responsible,v.email,'essential'),'22023','Campos obrigatórios inválidos','Recusa campo inválido: '||v.label)
from (values
 ('slug','   ','Nome','Centro','Marca','Pessoa','review@example.com'),
 ('nome','slug','   ','Centro','Marca','Pessoa','review@example.com'),
 ('unidade','slug','Nome','   ','Marca','Pessoa','review@example.com'),
 ('marca','slug','Nome','Centro','   ','Pessoa','review@example.com'),
 ('responsável','slug','Nome','Centro','Marca','   ','review@example.com'),
 ('email vazio','slug','Nome','Centro','Marca','Pessoa','   '),
 ('email inválido','slug','Nome','Centro','Marca','Pessoa','a@b')
) v(label,slug,name,unit_name,brand,responsible,email);
select * from finish();
rollback;
