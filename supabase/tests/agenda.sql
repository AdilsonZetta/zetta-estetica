begin;
set local search_path=public,extensions;
select plan(50);
select ok((select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('appointments','resource_reservations','agenda_blocks','waitlist_entries','agenda_outbox','agenda_manual_tasks','agenda_idempotency') and c.relkind='r'),'RLS em todas as tabelas da agenda');
select ok(not has_table_privilege('authenticated','private.appointments','INSERT'),'Sem escrita direta de agendamentos');
select ok(not has_table_privilege('authenticated','private.resource_reservations','SELECT'),'Sem leitura direta de reservas');
select ok(not has_table_privilege('anon','private.agenda_blocks','SELECT'),'Anônimo sem bloqueios');
select ok(not has_function_privilege('anon','public.agenda_reserve(uuid,uuid,uuid,uuid,timestamp without time zone,uuid[],text,integer,boolean,uuid)','EXECUTE'),'Anônimo não reserva');
select ok(not has_function_privilege('service_role','public.agenda_reserve(uuid,uuid,uuid,uuid,timestamp without time zone,uuid[],text,integer,boolean,uuid)','EXECUTE'),'Service role sem porta operacional');
select ok(has_function_privilege('authenticated','public.agenda_reserve(uuid,uuid,uuid,uuid,timestamp without time zone,uuid[],text,integer,boolean,uuid)','EXECUTE'),'Sessão autenticada reserva pela RPC');
select ok(not has_function_privilege('authenticated','private.agenda_occupy(uuid,uuid,uuid,uuid[],timestamp with time zone,timestamp with time zone,text)','EXECUTE'),'Ocupação interna fechada');
select ok(not has_function_privilege('authenticated','private.expire_agenda_holds_job()','EXECUTE'),'Job de expiração não é da sessão');
select ok((select bool_and(proconfig @> array['search_path=""']) from pg_proc where proname in ('agenda_reserve','agenda_reschedule','agenda_transition','agenda_block','expire_agenda_holds')),'Definers com search_path vazio');
select ok(exists(select 1 from pg_constraint where conname like '%excl%' and conrelid='private.resource_reservations'::regclass),'Exclusão GiST da ocupação ativa');

create temp table agenda_ids(k text primary key, id uuid);
grant all on agenda_ids to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from auth.users where email='a@example.com'),'role','authenticated')::text,true);
set local role authenticated;
insert into agenda_ids values
 ('pro', public.save_catalog_resource('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','{"kind":"professional","name":"Agenda pgTAP","units":[{"unit_id":"10000000-0000-0000-0000-000000000011","location":"Centro","capacity":1}]}')),
 ('room', public.save_catalog_resource('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','{"kind":"room","name":"Sala pgTAP","capabilities":["avaliacao"],"units":[{"unit_id":"10000000-0000-0000-0000-000000000011","location":"Sala","capacity":1}]}')),
 ('eq', public.save_catalog_resource('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','{"kind":"equipment","name":"Equipamento pgTAP","capabilities":["avaliacao"],"units":[{"unit_id":"10000000-0000-0000-0000-000000000011","location":"Armário","capacity":1}]}'));
select lives_ok(format($$select public.set_catalog_window('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,'shift','2026-12-02 08:00','2026-12-02 18:00')$$,(select id from agenda_ids where k='pro')),'Jornada do profissional');
select lives_ok(format($$select public.set_catalog_window('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,'shift','2026-12-02 08:00','2026-12-02 18:00')$$,(select id from agenda_ids where k='room')),'Jornada da sala');
select lives_ok(format($$select public.set_catalog_window('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,'shift','2026-12-02 08:00','2026-12-02 18:00')$$,(select id from agenda_ids where k='eq')),'Jornada do equipamento');
insert into agenda_ids values('version', public.publish_catalog_service('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',jsonb_build_object(
 'name','Avaliação pgTAP','category','Avaliação','duration_minutes',30,'buffer_before',0,'buffer_after',0,'price_cents',15000,'currency','BRL','state','published',
 'units',jsonb_build_array('10000000-0000-0000-0000-000000000011'),
 'resources',(select jsonb_agg(jsonb_build_object('resource_id',id,'unit_id','10000000-0000-0000-0000-000000000011')) from agenda_ids where k in ('pro','room','eq')),
 'requirements',jsonb_build_array(jsonb_build_object('kind','room','capability','avaliacao','quantity',1),jsonb_build_object('kind','equipment','capability','avaliacao','quantity',1)))));
insert into agenda_ids values('client', public.save_client('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','Mariana pgTAP'));
insert into agenda_ids values('a', (public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),'2026-12-02 09:00',(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq')),'agenda-key-a',10,false,null)->>'appointment_id')::uuid);
reset role;
select is((select state from private.appointments where id=(select id from agenda_ids where k='a')),'held','Reserva temporária ocupa o horário');
set local role authenticated;
select throws_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-12-02 09:00',%L,'agenda-key-b',10,true,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq'))),'23P01',null,'Segunda reserva do mesmo intervalo é conflito');
select lives_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-12-02 09:30',%L,'agenda-key-c',10,true,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq'))),'Intervalos contíguos sem buffer são aceitos');
select is(((public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),'2026-12-02 09:00',(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq')),'agenda-key-a',10,false,null))->>'appointment_id')::uuid,(select id from agenda_ids where k='a'),'Mesma chave idempotente devolve o mesmo agendamento');
select throws_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-12-02 15:00',%L,'agenda-key-a',10,false,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq'))),'22023',null,'Chave reutilizada com outro horário é recusada');
reset role;
select is((select count(*)::integer from private.appointments where id=(select id from agenda_ids where k='a')),1,'Replay não duplica a reserva');
set local role authenticated;
select throws_ok($$select public.agenda_reserve('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000401','10000000-0000-0000-0000-000000000211','2026-12-02 09:00',array['10000000-0000-0000-0000-000000000101']::uuid[],'agenda-key-x',10,false,null)$$,'42501',null,'Tenant cruzado negado');
select throws_ok($$insert into private.appointments(tenant_id,unit_id,client_id,service_id,service_version_id,state,starts_at,ends_at,timezone,local_start,local_end,created_by) values ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','confirmed',now(),now()+interval '30 min','America/Sao_Paulo',now(),now(),'00000000-0000-0000-0000-000000000000')$$,'42501',null,'Interface não grava a tabela de agendamentos');
reset role;
update private.appointments set hold_expires_at=now()-interval '1 minute' where id=(select id from agenda_ids where k='a');
set local role authenticated;
select lives_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-12-02 09:00',%L,'agenda-key-d',10,true,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq'))),'Hold vencido libera o horário para nova confirmação');
reset role;
select is((select state from private.appointments where id=(select id from agenda_ids where k='a')),'expired','Hold vencido fica expirado');
select is((select bool_and(not occupies) from private.resource_reservations where appointment_id=(select id from agenda_ids where k='a')),true,'Expiração libera a alocação');
select ok((select count(*)>0 from private.agenda_outbox where entity_id=(select id from agenda_ids where k='a') and event_name='appointment.expired.v1'),'Expiração grava outbox na mesma operação');
set local role authenticated;
insert into agenda_ids values('buf', public.publish_catalog_service('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',jsonb_build_object(
 'name','Com buffer pgTAP','category','Avaliação','duration_minutes',30,'buffer_before',10,'buffer_after',10,'price_cents',15000,'currency','BRL','state','published',
 'units',jsonb_build_array('10000000-0000-0000-0000-000000000011'),
 'resources',(select jsonb_agg(jsonb_build_object('resource_id',id,'unit_id','10000000-0000-0000-0000-000000000011')) from agenda_ids where k in ('pro','room','eq')),
 'requirements','[]'::jsonb)));
insert into agenda_ids values('left', (public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',(select id from agenda_ids where k='client'),(select id from agenda_ids where k='buf'),'2026-12-02 13:00',(select array_agg(id) from agenda_ids where k='pro'),'agenda-key-left',10,true,null)->>'appointment_id')::uuid);
select throws_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-12-02 13:20',%L,'agenda-key-mid',10,true,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='buf'),(select array_agg(id) from agenda_ids where k='pro')),'23P01',null,'Buffers impedem horários que o serviço puro deixaria passar');
select lives_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-12-02 13:50',%L,'agenda-key-right',10,true,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='buf'),(select array_agg(id) from agenda_ids where k='pro')),'Buffers contíguos são aceitos');
select throws_ok(format($$select public.agenda_reschedule('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,1,'2026-12-02 13:50',%L,'agenda-key-bad',10)$$,(select id from agenda_ids where k='left'),(select array_agg(id) from agenda_ids where k='pro')),'23P01',null,'Reagendamento inválido é conflito de negócio');
reset role;
select is((select local_start from private.appointments where id=(select id from agenda_ids where k='left')),'2026-12-02 13:00'::timestamp,'Falha no reagendamento preserva o horário original');
select is((select version from private.appointments where id=(select id from agenda_ids where k='left')),1,'Falha no reagendamento preserva a versão');
select is((select bool_and(occupies) from private.resource_reservations where appointment_id=(select id from agenda_ids where k='left')),true,'Falha no reagendamento preserva a alocação');
set local role authenticated;
select is((public.agenda_transition('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',(select id from agenda_ids where k='left'),1,'no_show','agenda-key-ns','Cliente não compareceu')->>'state'),'no_show','Falta registrada');
reset role;
select is((select bool_and(not occupies) from private.resource_reservations where appointment_id=(select id from agenda_ids where k='left')),true,'Falta libera a alocação');
select ok((select count(*)>0 from private.agenda_manual_tasks m join private.agenda_outbox e on e.tenant_id=m.tenant_id and e.id=m.event_id where e.entity_id=(select id from agenda_ids where k='left') and e.event_name='appointment.no_show.v1' and m.code='CAPABILITY_NOT_VERIFIED'),'Falta gera tarefa manual porque a FLW não está comprovada');
set local role authenticated;
select throws_ok(format($$select public.agenda_block('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,'2026-12-02 13:50','2026-12-02 14:20','Manutenção','agenda-key-block')$$,(select id from agenda_ids where k='pro')),'23P01',null,'Bloqueio rígido entra na mesma ocupação');
insert into agenda_ids values('wait', ((public.agenda_waitlist_join('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),'[{"local_start":"2026-12-02 16:00","local_end":"2026-12-02 18:00"}]'::jsonb,'agenda-key-wait',(select array_agg(id) from agenda_ids where k='pro'),90,''))->>'waitlist_entry_id')::uuid);
select ok((select id from agenda_ids where k='wait') is not null,'Entrada na lista de espera');
insert into agenda_ids values('fit', ((public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),'2026-12-02 16:00',(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq')),'agenda-key-fit',10,true,(select id from agenda_ids where k='wait')))->>'appointment_id')::uuid);
reset role;
select is((select state from private.waitlist_entries where appointment_id=(select id from agenda_ids where k='fit')),'accepted','Encaixe aceito usa a reserva e marca a fila');
select is((select count(*)::integer from private.resource_reservations where appointment_id=(select id from agenda_ids where k='fit') and occupies),3,'Encaixe grava uma ocupação por recurso');
set local role authenticated;
select lives_ok($$select public.set_catalog_timezone('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','America/New_York')$$,'Fuso da unidade pode mudar');
select throws_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-03-08 02:30',%L,'agenda-key-tz',10,false,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq'))),'22023',null,'Horário inexistente no fuso da unidade é recusado');
select lives_ok($$select public.set_catalog_timezone('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','America/Sao_Paulo')$$,'Fuso restaurado');
reset role;
insert into public.membership_units(tenant_id,membership_id,unit_id)
select m.tenant_id,m.id,'10000000-0000-0000-0000-000000000012' from public.tenant_memberships m join auth.users u on u.id=m.user_id where u.email='a@example.com' and m.tenant_id='10000000-0000-0000-0000-000000000001'
on conflict do nothing;
insert into private.catalog_resource_units(tenant_id,resource_id,unit_id,location,capacity)
values ('10000000-0000-0000-0000-000000000001',(select id from agenda_ids where k='pro'),'10000000-0000-0000-0000-000000000012','Restrita',1);
insert into private.catalog_windows(tenant_id,resource_id,unit_id,kind,period,timezone,local_start,local_end,reason)
select '10000000-0000-0000-0000-000000000001',(select id from agenda_ids where k='pro'),'10000000-0000-0000-0000-000000000012','shift',tstzrange('2026-12-03 13:00-03','2026-12-03 18:00-03','[)'),'America/Sao_Paulo','2026-12-03 13:00','2026-12-03 18:00','Tarde na segunda unidade';
insert into private.catalog_service_units(tenant_id,version_id,unit_id)
select tenant_id,id,'10000000-0000-0000-0000-000000000012' from private.catalog_service_versions where id=(select id from agenda_ids where k='buf');
insert into private.catalog_service_resources(tenant_id,version_id,unit_id,resource_id)
select '10000000-0000-0000-0000-000000000001',(select id from agenda_ids where k='buf'),'10000000-0000-0000-0000-000000000012',(select id from agenda_ids where k='pro');
insert into agenda_ids values('client_ux', public.save_client('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000012','Mariana tarde'));
set local role authenticated;
select lives_ok(format($$select public.agenda_block('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,'2026-12-03 15:00','2026-12-03 15:30','Bloqueio global','agenda-key-global')$$,(select id from agenda_ids where k='pro')),'Bloqueio na unidade de origem');
select throws_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000012',%L,%L,'2026-12-03 15:00',%L,'agenda-key-other',10,true,null)$$,(select id from agenda_ids where k='client_ux'),(select id from agenda_ids where k='buf'),(select array_agg(id) from agenda_ids where k='pro')),'23P01',null,'O mesmo profissional não é reservado em outra unidade no intervalo ocupado');
select lives_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000012',%L,%L,'2026-12-03 16:30',%L,'agenda-key-after',10,true,null)$$,(select id from agenda_ids where k='client_ux'),(select id from agenda_ids where k='buf'),(select array_agg(id) from agenda_ids where k='pro')),'O mesmo profissional atende em outra unidade fora do bloqueio');
reset role;
update public.tenant_memberships set role='professional' where tenant_id='10000000-0000-0000-0000-000000000001' and user_id=(select id from auth.users where email='a@example.com');
set local role authenticated;
select lives_ok($$select public.agenda_grid('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','2026-12-02','week')$$,'Profissional consulta a grade');
select throws_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-12-02 17:00',%L,'agenda-key-pro',10,false,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq'))),'42501',null,'Profissional não reserva');
reset role;
update public.tenant_memberships set role='clinic_admin' where tenant_id='10000000-0000-0000-0000-000000000001' and user_id=(select id from auth.users where email='a@example.com');
update public.tenant_entitlements set enabled=false where tenant_id='10000000-0000-0000-0000-000000000001' and module_key='agenda';
set local role authenticated;
select throws_ok($$select public.agenda_grid('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','2026-12-02','day')$$,'42501',null,'Módulo agenda desligado nega a grade');
reset role;
update public.tenant_entitlements set enabled=true where tenant_id='10000000-0000-0000-0000-000000000001' and module_key='agenda';
create function pg_temp.fail_agenda() returns trigger language plpgsql as $$ begin if new.event_name='appointment.held.v1' then raise exception 'Falha injetada' using errcode='P0001'; end if; return new; end $$;
create trigger fail_agenda before insert on private.agenda_outbox for each row execute function pg_temp.fail_agenda();
set local role authenticated;
select throws_ok(format($$select public.agenda_reserve('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011',%L,%L,'2026-12-02 17:00',%L,'agenda-key-roll',10,false,null)$$,(select id from agenda_ids where k='client'),(select id from agenda_ids where k='version'),(select array_agg(id order by k) from agenda_ids where k in ('pro','room','eq'))),'P0001','Falha injetada','Falha na outbox aborta a reserva');
reset role;
select is((select count(*)::integer from private.appointments where local_start='2026-12-02 17:00'),0,'Nenhum agendamento parcial após falha da outbox');
select * from finish();
rollback;
