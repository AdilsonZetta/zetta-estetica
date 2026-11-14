import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { A, UA, login } from './foundation-support.mjs'
import { sql } from './console-support.mjs'
const run = promisify(execFile)
const claim = async (id) =>
  (
    await run('psql', [
      '-X',
      '-h',
      'localhost',
      '-p',
      '54322',
      '-U',
      'postgres',
      '-d',
      'zetta',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-c',
      `set role service_role; set request.jwt.claim.role='service_role'; select public.claim_flw_delivery('${A}','${id}')`
    ])
  ).stdout
    .trim()
    .split('\n')
    .at(-1)
test('FLW: deduplicação concorrente e lease único por conexão', async (t) => {
  const a = await login('a@example.com'),
    entity = randomUUID(),
    entity2 = randomUUID()
  t.after(() =>
    sql(
      `delete from private.integration_manual_tasks where event_id in (select id from private.outbox_events where entity_id in ('${entity}','${entity2}')); delete from private.integration_deliveries where event_id in (select id from private.outbox_events where entity_id in ('${entity}','${entity2}')); delete from private.outbox_events where entity_id in ('${entity}','${entity2}')`
    )
  )
  const args = {
    tenant: A,
    unit: UA,
    operation: 'card.update',
    entity,
    version: 1,
    correlation: randomUUID(),
    simulation: true
  }
  const results = await Promise.all(
    Array.from({ length: 12 }, () => a.rpc('request_flw_operation', args))
  )
  for (const r of results) assert.equal(r.error, null)
  assert.equal(new Set(results.map((r) => r.data.event_id)).size, 1)
  const second = await a.rpc('request_flw_operation', {
    ...args,
    entity: entity2
  })
  assert.equal(second.error, null)
  const claims = await Promise.all(
    Array.from({ length: 12 }, (_, n) =>
      claim(n % 2 ? results[0].data.delivery_id : second.data.delivery_id)
    )
  )
  assert.equal(claims.filter((x) => x.startsWith('{')).length, 1)
})
