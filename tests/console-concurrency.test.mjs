import { test } from 'node:test'
import assert from 'node:assert/strict'
import { platformFixture, provisionArgs } from './console-support.mjs'

test('Quota transacional: 12 criações concorrentes disputam a última unidade', async (t) => {
  const f = await platformFixture()
  t.after(() => f.cleanup())
  const r = await f.c.rpc(
    'provision_tenant',
    provisionArgs('quota@example.com')
  )
  assert.equal(r.error, null)
  const tenant = r.data
  f.tenants.push(tenant)
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      f.c.rpc('add_tenant_unit', { tenant, name: `Unidade sintética ${i}` })
    )
  )
  assert.equal(results.filter((r) => r.error === null).length, 1)
  for (const r of results.filter((r) => r.error))
    assert.equal(r.error.code, 'P0001')
  const snap = await f.c.rpc('console_snapshot')
  assert.equal(snap.data.tenants.find((t) => t.id === tenant).units.length, 2)
})
