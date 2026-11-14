import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { A, UA, login } from './foundation-support.mjs'
import { sql } from './console-support.mjs'
test('Clientes: 12 merges repetidos, disputa inversa e edição concorrente', async (t) => {
  const a = await login('a@example.com'),
    ids = [],
    name = `concorrencia_${randomUUID()}`
  t.after(() =>
    sql(
      `delete from private.client_events where client_id in ('${ids.join("','")}');delete from private.client_links where client_id in ('${ids.join("','")}');delete from private.clients where id in ('${ids.join("','")}')`
    )
  )
  const create = async () => {
    const r = await a.rpc('save_client', {
      tenant: A,
      unit: UA,
      name,
      reviewed: true
    })
    assert.equal(r.error, null)
    ids.push(r.data)
    return r.data
  }
  const args = (source, survivor) => ({
    tenant: A,
    unit: UA,
    source,
    survivor,
    source_version: 1,
    survivor_version: 1,
    reason: 'Revisão concorrente sintética',
    confirmed: true
  })
  const [s, d] = [await create(), await create()]
  const repeated = await Promise.all(
    Array.from({ length: 12 }, () => a.rpc('merge_clients', args(s, d)))
  )
  for (const r of repeated) {
    assert.equal(r.error, null)
    assert.deepEqual(r.data, repeated[0].data)
  }
  assert.equal(
    sql(
      `select count(*) from private.client_events where client_id='${s}' and action='client_merged'`
    ),
    '1'
  )
  const [x, y] = [await create(), await create()]
  const inverse = await Promise.all([
    a.rpc('merge_clients', args(x, y)),
    a.rpc('merge_clients', args(y, x))
  ])
  assert.equal(inverse.filter((r) => !r.error).length, 1)
  assert.equal(inverse.filter((r) => r.error?.code === '22023').length, 1)
  const c = await create()
  const edits = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      a.rpc('save_client', {
        tenant: A,
        unit: UA,
        client: c,
        expected_version: 1,
        name: `${name}_${i}`,
        reviewed: true
      })
    )
  )
  assert.equal(edits.filter((r) => !r.error).length, 1)
  assert.equal(edits.filter((r) => r.error?.code === '40001').length, 11)
  const linkArgs = {
    tenant: A,
    unit: UA,
    client: c,
    kind: 'card',
    reference: name,
    source: 'concorrencia'
  }
  const created = await a.rpc('set_client_link', linkArgs)
  assert.equal(created.error, null)
  const before = await a.rpc('client_detail', {
    tenant: A,
    unit: UA,
    client: c
  })
  assert.equal(before.error, null)
  const reviews = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      a.rpc('set_client_link', {
        ...linkArgs,
        link: created.data,
        expected_version: before.data.client.version,
        link_state: i % 2 ? 'confirmed' : 'retired'
      })
    )
  )
  assert.equal(reviews.filter((r) => !r.error).length, 1)
  assert.equal(reviews.filter((r) => r.error?.code === '40001').length, 11)
  const after = await a.rpc('client_detail', {
    tenant: A,
    unit: UA,
    client: c
  })
  assert.equal(after.error, null)
  assert.equal(after.data.client.version, before.data.client.version + 1)
  assert.equal(
    after.data.history.filter((h) => h.action === 'client_link_reviewed')
      .length,
    2
  )
})
