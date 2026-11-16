import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { A, UA, UX } from './foundation-support.mjs'
import { sql } from './console-support.mjs'
import {
  catalogFixture,
  resourcePayload,
  servicePayload,
} from './catalog-support.mjs'
test('Catálogo: concorrência de versões e jornada única entre unidades', async (t) => {
  const f = await catalogFixture(t),
    marker = `race_${randomUUID()}`
  const r = await f.resource(resourcePayload(marker, [UA, UX])),
    s = await f.service(servicePayload(marker))
  const calls = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      f.c.rpc('publish_catalog_service', {
        tenant: A,
        unit: UA,
        service: s.id,
        expected_version: 1,
        payload: servicePayload(marker, { price_cents: 15000 + i }),
      }),
    ),
  )
  assert.equal(calls.filter((x) => !x.error).length, 1)
  assert.equal(calls.filter((x) => x.error?.code === '40001').length, 11)
  assert.equal(
    sql(
      `select count(*) from private.catalog_service_versions where service_id='${s.id}'`,
    ),
    '2',
  )
  const windows = await Promise.all(
    [UA, UX].map((unit) =>
      f.c.rpc('set_catalog_window', {
        tenant: A,
        unit,
        resource: r,
        kind: 'shift',
        local_start: '2026-11-17T09:00',
        local_end: '2026-11-17T12:00',
      }),
    ),
  )
  assert.equal(windows.filter((x) => !x.error).length, 1)
  assert.equal(windows.filter((x) => x.error?.code === '23P01').length, 1)
  assert.equal(
    sql(
      `select count(*) from private.catalog_windows where resource_id='${r}'`,
    ),
    '1',
  )
  assert.equal(
    sql(
      `select count(*) from public.audit_logs where entity_id in (select id::text from private.catalog_windows where resource_id='${r}') and action='catalog_window_saved'`,
    ),
    '1',
  )
  const edits = await Promise.all(
    Array.from({ length: 12 }, () =>
      f.c.rpc('save_catalog_resource', {
        tenant: A,
        unit: UA,
        resource: r,
        expected_version: 1,
        payload: resourcePayload(marker, [UA, UX]),
      }),
    ),
  )
  assert.equal(edits.filter((x) => !x.error).length, 1)
  assert.equal(edits.filter((x) => x.error?.code === '40001').length, 11)
})
