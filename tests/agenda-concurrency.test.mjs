import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const A = '10000000-0000-0000-0000-000000000001'
const UA = '10000000-0000-0000-0000-000000000011'
function psql(sql, allowError = false) {
  return new Promise((resolve) => {
    const child = spawn('psql', ['-h', 'localhost', '-p', '54322', '-U', 'postgres', '-d', 'zetta', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At', '-c', sql])
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', (chunk) => { err += chunk })
    child.on('close', (code) => resolve({ code, out, err, ok: code === 0 }))
    child.on('error', (error) => resolve({ code: 1, out, err: `${err}\n${error.message}`, ok: false }))
    if (allowError) return
  })
}
test('Agenda: duas sessões não ocupam o mesmo profissional, sala e equipamento', async () => {
  const marker = `race_${randomUUID().slice(0, 8)}`
  const setup = await psql(`
    select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from auth.users where email='a@example.com'),'role','authenticated')::text, true);
    set local role authenticated;
    with pro as (select public.save_catalog_resource('${A}','${UA}', jsonb_build_object('kind','professional','name','${marker} pro','units',jsonb_build_array(jsonb_build_object('unit_id','${UA}','location','Centro','capacity',1)))) id),
    room as (select public.save_catalog_resource('${A}','${UA}', jsonb_build_object('kind','room','name','${marker} sala','capabilities',jsonb_build_array('avaliacao'),'units',jsonb_build_array(jsonb_build_object('unit_id','${UA}','location','Sala','capacity',1)))) id),
    eq as (select public.save_catalog_resource('${A}','${UA}', jsonb_build_object('kind','equipment','name','${marker} eq','capabilities',jsonb_build_array('avaliacao'),'units',jsonb_build_array(jsonb_build_object('unit_id','${UA}','location','Armário','capacity',1)))) id)
    select (select id from pro)||'|'||(select id from room)||'|'||(select id from eq);
  `)
  assert.equal(setup.ok, true, setup.err)
  const [pro, room, eq] = setup.out.trim().split('\n').at(-1).split('|')
  const prepared = await psql(`
    select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from auth.users where email='a@example.com'),'role','authenticated')::text, true);
    set local role authenticated;
    select public.set_catalog_window('${A}','${UA}','${pro}','shift','2026-12-10 08:00','2026-12-10 18:00');
    select public.set_catalog_window('${A}','${UA}','${room}','shift','2026-12-10 08:00','2026-12-10 18:00');
    select public.set_catalog_window('${A}','${UA}','${eq}','shift','2026-12-10 08:00','2026-12-10 18:00');
    select public.publish_catalog_service('${A}','${UA}', jsonb_build_object('name','${marker}','category','Avaliação','duration_minutes',30,'buffer_before',0,'buffer_after',0,'price_cents',1000,'currency','BRL','state','published','units',jsonb_build_array('${UA}'),'resources',jsonb_build_array(jsonb_build_object('resource_id','${pro}','unit_id','${UA}'),jsonb_build_object('resource_id','${room}','unit_id','${UA}'),jsonb_build_object('resource_id','${eq}','unit_id','${UA}')),'requirements',jsonb_build_array(jsonb_build_object('kind','room','capability','avaliacao','quantity',1),jsonb_build_object('kind','equipment','capability','avaliacao','quantity',1))));
    select public.save_client('${A}','${UA}','${marker}');
  `)
  assert.equal(prepared.ok, true, prepared.err)
  const lines = prepared.out.trim().split('\n').filter((line) => /^[0-9a-f-]{36}$/.test(line))
  const version = lines.at(-2)
  const client = lines.at(-1)
  const resources = `array['${pro}','${room}','${eq}']::uuid[]`
  const call = (key) => psql(`
    select set_config('request.jwt.claims', jsonb_build_object('sub',(select id from auth.users where email='a@example.com'),'role','authenticated')::text, true);
    set local role authenticated;
    select public.agenda_reserve('${A}','${UA}','${client}','${version}','2026-12-10 09:00',${resources},'${key}',10,true,null)::text;
  `, true)
  const service = await psql(`select service_id from private.catalog_service_versions where id='${version}'`)
  assert.equal(service.ok, true, service.err)
  const serviceId = service.out.trim()
  try {
    const [first, second] = await Promise.all([call(`race-${marker}-a`), call(`race-${marker}-b`)])
    const responses = [first, second]
    const winner = responses.filter((item) => item.ok)
    const loser = responses.filter((item) => !item.ok)
    assert.equal(winner.length, 1, JSON.stringify(responses))
    assert.equal(loser.length, 1)
    assert.match(`${loser[0].err}\n${loser[0].out}`, /23P01|Conflito de reserva/)
    const state = await psql(`
      select (select count(*) from private.appointments where client_id='${client}' and state='confirmed')
      ||'|'|| (select count(*) from private.resource_reservations where occupies and resource_id in ('${pro}','${room}','${eq}'))
      ||'|'|| (select count(distinct appointment_id) from private.resource_reservations where occupies and resource_id='${pro}');
    `)
    assert.equal(state.ok, true, state.err)
    assert.equal(state.out.trim(), '1|3|1')
  } finally {
    const cleaned = await psql(`
      delete from private.resource_reservations where resource_id in ('${pro}','${room}','${eq}');
      delete from private.appointment_resources where resource_id in ('${pro}','${room}','${eq}');
      delete from private.appointments where client_id='${client}';
      delete from private.agenda_idempotency where idempotency_key like 'race-${marker}-%';
      delete from private.catalog_service_resources where resource_id in ('${pro}','${room}','${eq}');
      delete from private.catalog_requirements where version_id='${version}';
      delete from private.catalog_service_units where version_id='${version}';
      delete from private.catalog_service_versions where id='${version}';
      delete from private.catalog_services where id='${serviceId}';
      delete from private.catalog_windows where resource_id in ('${pro}','${room}','${eq}');
      delete from private.catalog_resource_units where resource_id in ('${pro}','${room}','${eq}');
      delete from private.catalog_resources where id in ('${pro}','${room}','${eq}');
      delete from private.client_events where client_id='${client}';
      delete from private.client_links where client_id='${client}';
      delete from private.clients where id='${client}';
    `)
    assert.equal(cleaned.ok, true, cleaned.err)
  }
})
