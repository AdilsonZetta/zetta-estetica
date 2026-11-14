import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { A, B, UA, UB, UX, login } from './foundation-support.mjs'
import { sql } from './console-support.mjs'
import { client } from './local-auth.mjs'

test('Adaptador FLW: sessões reais, isolamento e tarefa manual', async (t) => {
  const [a, b, z] = await Promise.all(
    ['a@example.com', 'b@example.com', 'zetta@example.com'].map(login)
  )
  const entity = randomUUID()
  t.after(() =>
    sql(
      `delete from private.integration_manual_tasks where event_id in (select id from private.outbox_events where entity_id='${entity}'); delete from private.integration_deliveries where event_id in (select id from private.outbox_events where entity_id='${entity}'); delete from private.outbox_events where entity_id='${entity}'`
    )
  )
  const args = {
    tenant: A,
    unit: UA,
    operation: 'contact.lookup',
    entity,
    version: 1,
    correlation: randomUUID()
  }
  let event
  await t.test(
    'Pendente retorna código e cria uma tarefa por evento',
    async () => {
      const first = await a.rpc('request_flw_operation', args)
      assert.equal(first.error, null)
      const candidates = await a.rpc('flw_work_candidates', {
        tenant: A,
        unit: UA
      })
      assert.equal(candidates.error, null)
      assert.ok(Array.isArray(candidates.data))
      event = first.data
      assert.equal(event.code, 'CAPABILITY_NOT_VERIFIED')
      assert.equal(event.state, 'manual')
      const repeat = await a.rpc('request_flw_operation', {
        ...args,
        correlation: randomUUID()
      })
      assert.deepEqual(repeat.data, event)
    }
  )
  await t.test(
    'B, unidade não atribuída, global e anônimo negados',
    async () => {
      for (const [c, tenant, unit] of [
        [b, A, UA],
        [a, B, UB],
        [a, A, UX],
        [z, A, UA],
        [client(), A, UA]
      ])
        for (const rpc of ['flw_operations', 'flw_work_candidates'])
          assert.equal(
            (await c.rpc(rpc, { tenant, unit })).error?.code,
            '42501'
          )
    }
  )
  await t.test(
    'Usuário não chama worker nem publica schema privado',
    async () => {
      assert.equal(
        (
          await a.rpc('claim_flw_delivery', {
            tenant: A,
            delivery: event.delivery_id
          })
        ).error?.code,
        '42501'
      )
      assert.ok(
        (await a.schema('private').from('outbox_events').select()).error
      )
    }
  )
  await t.test('Tarefa só aceita referência opaca; B não conclui', async () => {
    const rows = await a.rpc('flw_operations', { tenant: A, unit: UA })
    assert.equal(rows.error, null)
    const row = rows.data.find((x) => x.event_id === event.event_id)
    assert.ok(row.task_id)
    assert.equal(
      (
        await b.rpc('complete_flw_manual_task', {
          tenant: A,
          task: row.task_id,
          reference: 'contato_123'
        })
      ).error?.code,
      '42501'
    )
    assert.equal(
      (
        await a.rpc('complete_flw_manual_task', {
          tenant: A,
          task: row.task_id,
          reference: 'https://example.invalid?token=secret'
        })
      ).error?.code,
      '22023'
    )
    assert.equal(
      (
        await a.rpc('complete_flw_manual_task', {
          tenant: A,
          task: row.task_id,
          reference: 'contato_123'
        })
      ).error,
      null
    )
    const done = (
      await a.rpc('flw_operations', { tenant: A, unit: UA })
    ).data.find((x) => x.event_id === event.event_id)
    assert.equal(done.task_state, 'done')
    assert.equal(done.external_ref, 'contato_123')
    assert.equal(done.state, 'manual')
  })
  await t.test('Replay de estado manual é recusado', async () => {
    assert.equal(
      (
        await a.rpc('replay_flw_delivery', {
          tenant: A,
          delivery: event.delivery_id
        })
      ).error?.code,
      '22023'
    )
  })
})
