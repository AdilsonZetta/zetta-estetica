import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { A, B, UA, UB, UX, login } from './foundation-support.mjs'
import { sql } from './console-support.mjs'
import { client } from './local-auth.mjs'
import {
  catalogFixture,
  resourcePayload,
  servicePayload,
} from './catalog-support.mjs'
test('Catálogo: integridade, versões e jornadas com sessões reais', async (t) => {
  const f = await catalogFixture(t),
    marker = `catalog_${randomUUID()}`
  const [a, b, global, revoked] = await Promise.all(
    [
      'a@example.com',
      'b@example.com',
      'zetta@example.com',
      'revogado@example.com',
    ].map(login),
  )
  const resource = await f.resource(resourcePayload(marker, [UA, UX]))
  const room = await f.resource(
    resourcePayload(`${marker}_sala`, [UA], { kind: 'room' }),
  )
  const equipment = await f.resource(
    resourcePayload(`${marker}_equipamento`, [UA, UX], { kind: 'equipment' }),
  )
  const payload = servicePayload(marker, {
    resources: [resource, room, equipment].map((resource_id) => ({
      resource_id,
      unit_id: UA,
    })),
  })
  const s = await f.service(payload)
  const read = async (kind = 'services', c = f.c, unit = UA) =>
    c.rpc('list_catalog', { tenant: A, unit, kind, query: marker })
  await t.test(
    'Tenant, unidade, revogação, global e anônimo são validados no banco',
    async () => {
      for (const c of [b, global, revoked, client()])
        assert.ok((await read('services', c)).error)
      assert.equal((await read('resources', a, UX)).error.code, '42501')
      assert.equal(
        (await f.c.rpc('list_catalog', { tenant: B, unit: UB })).error.code,
        '42501',
      )
      assert.ok((await a.from('catalog_resources').select('*')).error)
      assert.equal((await read()).data.length, 1)
      const team = await f.c.rpc('catalog_team_options', {
        tenant: A,
        unit: UA,
      })
      assert.equal(team.error, null)
      assert.match(
        team.data.find((x) => x.id === f.member).name,
        /@example\.com · Gerente$/,
      )
      assert.equal(
        (await b.rpc('catalog_team_options', { tenant: A, unit: UA })).error
          .code,
        '42501',
      )
    },
  )
  await t.test(
    'Preço inconsistente, duração e buffers inválidos abortam sem versão nova',
    async () => {
      for (const patch of [
        { price_cents: -1 },
        { price_cents: 1.5 },
        { duration_minutes: 0 },
        { duration_minutes: 1.5 },
        { buffer_before: -1 },
        { currency: 'brl' },
      ]) {
        const r = await f.c.rpc('publish_catalog_service', {
          tenant: A,
          unit: UA,
          service: s.id,
          expected_version: 1,
          payload: { ...payload, ...patch },
        })
        assert.ok(r.error)
      }
      assert.equal(
        sql(
          `select current_version from private.catalog_services where id='${s.id}'`,
        ),
        '1',
      )
    },
  )
  await t.test(
    'Equipe sem escopo, vínculos cruzados e edição parcial são recusados',
    async () => {
      const mid = sql(
        `select m.id from public.tenant_memberships m join auth.users u on u.id=m.user_id where m.tenant_id='${A}' and u.email='a@example.com'`,
      )
      assert.equal(
        (
          await f.c.rpc('save_catalog_resource', {
            tenant: A,
            unit: UA,
            payload: resourcePayload(marker, [UA, UX], { membership_id: mid }),
          })
        ).error.code,
        '22023',
      )
      assert.equal(
        (
          await a.rpc('save_catalog_resource', {
            tenant: A,
            unit: UA,
            resource,
            expected_version: 1,
            payload: resourcePayload(marker),
          })
        ).error.code,
        '42501',
      )
      assert.ok(
        (
          await f.c.rpc('publish_catalog_service', {
            tenant: A,
            unit: UA,
            payload: {
              ...payload,
              resources: [{ resource_id: randomUUID(), unit_id: UA }],
            },
          })
        ).error,
      )
      assert.ok(
        (
          await f.c.rpc('publish_catalog_service', {
            tenant: A,
            unit: UA,
            payload: {
              ...payload,
              resources: [{ resource_id: room, unit_id: UB }],
            },
          })
        ).error,
      )
    },
  )
  await t.test(
    'Nova versão e inativação preservam preço, duração e referências históricas',
    async () => {
      const r = await f.c.rpc('publish_catalog_service', {
        tenant: A,
        unit: UA,
        service: s.id,
        expected_version: 1,
        payload: {
          ...payload,
          price_cents: 18000,
          duration_minutes: 45,
          state: 'inactive',
        },
      })
      assert.equal(r.error, null)
      assert.notEqual(r.data, s.version_id)
      const history = await f.c.rpc('catalog_service_history', {
        tenant: A,
        unit: UA,
        service: s.id,
      })
      assert.equal(history.error, null)
      assert.equal(history.data.length, 2)
      assert.equal(history.data[1].price_cents, 15000)
      assert.equal(history.data[1].duration_minutes, 30)
      assert.equal((await read()).data[0].state, 'inactive')
      assert.equal(
        (
          await f.c.rpc('publish_catalog_service', {
            tenant: A,
            unit: UA,
            service: s.id,
            expected_version: 1,
            payload,
          })
        ).error.code,
        '40001',
      )
      assert.equal(
        (
          await f.c.rpc('catalog_availability', {
            tenant: A,
            unit: UA,
            local_start: '2026-11-16T09:00',
            local_end: '2026-11-16T09:30',
            version_id: s.version_id,
          })
        ).error.code,
        '22023',
      )
    },
  )
  const window = (unit, resource_id, kind, start = '09:00', end = '12:00') =>
    f.c.rpc('set_catalog_window', {
      tenant: A,
      unit,
      resource: resource_id,
      kind,
      local_start: `2026-11-16T${start}`,
      local_end: `2026-11-16T${end}`,
      reason: 'Teste sintético',
    })
  await t.test(
    'Identidade multiunidade: conflitos globais, contiguidade e fusos',
    async () => {
      assert.equal((await window(UA, resource, 'shift')).error, null)
      assert.equal(
        (await window(UX, resource, 'shift', '11:00', '13:00')).error.code,
        '23P01',
      )
      assert.equal(
        (await window(UX, resource, 'shift', '12:00', '15:00')).error,
        null,
      )
      assert.equal(
        sql(
          `select count(distinct resource_id) from private.catalog_windows where resource_id='${resource}'`,
        ),
        '1',
      )
      assert.equal(
        sql(
          `select lower(period) at time zone 'UTC' from private.catalog_windows where resource_id='${resource}' and unit_id='${UA}'`,
        ),
        '2026-11-16 12:00:00',
      )
      assert.equal(
        (await window(UA, room, 'shift', '12:00', '09:00')).error.code,
        '22023',
      )
      assert.equal(
        (
          await f.c.rpc('set_catalog_timezone', {
            tenant: A,
            unit: UA,
            timezone: 'Brasil/Inexistente',
          })
        ).error.code,
        '22023',
      )
    },
  )
  await t.test(
    'Disponibilidade configurada considera capacidade, buffers, folgas e feriados',
    async () => {
      for (const r of [room, equipment])
        assert.equal((await window(UA, r, 'shift')).error, null)
      assert.equal(
        (await window(UX, equipment, 'shift', '10:00', '11:00')).error.code,
        '23P01',
      )
      assert.equal(
        (await window(UX, equipment, 'shift', '13:00', '15:00')).error,
        null,
      )
      const v = await f.service({ ...payload, name: `${marker}_ativo` })
      const args = {
        tenant: A,
        unit: UA,
        local_start: '2026-11-16T09:30',
        local_end: '2026-11-16T10:00',
        version_id: v.version_id,
      }
      const result = await f.c.rpc('catalog_availability', args)
      assert.equal(result.error, null)
      assert.equal(result.data.filter((x) => x.available).length, 3)
      assert.equal(
        (
          await f.c.rpc('catalog_availability', {
            ...args,
            local_start: '2026-11-16T09:00',
            local_end: '2026-11-16T09:30',
          })
        ).data.find((x) => x.id === resource).available,
        false,
      )
      const off = await window(UA, resource, 'off', '09:40', '09:50')
      assert.equal(off.error, null)
      assert.equal(
        (await f.c.rpc('catalog_availability', args)).data.find(
          (x) => x.id === resource,
        ).available,
        false,
      )
      assert.equal(
        (
          await f.c.rpc('delete_catalog_window', {
            tenant: A,
            unit: UA,
            window_id: off.data,
          })
        ).error,
        null,
      )
      assert.equal(
        (await window(UA, equipment, 'holiday', '00:00', '23:59')).error,
        null,
      )
      assert.equal(
        (await f.c.rpc('catalog_availability', args)).data.find(
          (x) => x.id === equipment,
        ).available,
        false,
      )
      assert.equal(
        (
          await f.c.rpc('save_catalog_resource', {
            tenant: A,
            unit: UA,
            resource: equipment,
            expected_version: 1,
            payload: resourcePayload(`${marker}_equipamento`, [UA, UX], {
              kind: 'equipment',
              active: false,
            }),
          })
        ).error,
        null,
      )
      assert.ok(
        !(await f.c.rpc('catalog_availability', args)).data.some(
          (x) => x.id === equipment,
        ),
      )
    },
  )
  await t.test(
    'Pesquisa, paginação, auditoria e proteção de remoções históricas',
    async () => {
      const list = await read('resources')
      assert.equal(list.error, null)
      assert.equal(list.data.length, 3)
      assert.equal(
        (
          await f.c.rpc('list_catalog', {
            tenant: A,
            unit: UA,
            kind: 'resources',
            query: marker,
            after_id: list.data[0].id,
          })
        ).data.length,
        2,
      )
      assert.equal(
        (
          await f.c.rpc('save_catalog_resource', {
            tenant: A,
            unit: UA,
            resource,
            expected_version: 1,
            payload: resourcePayload(marker, [UA]),
          })
        ).error.code,
        '23503',
      )
      assert.ok(
        Number(
          sql(
            `select count(*) from public.audit_logs where entity_id='${s.version_id}' and actor_id is not null`,
          ),
        ) >= 1,
      )
    },
  )
  await t.test(
    'Vínculo da equipe perde habilitação imediatamente após revogação',
    async () => {
      const linked = await f.resource(
        resourcePayload(`${marker}_vinculado`, [UA], {
          membership_id: f.member,
        }),
      )
      const v = await f.service(
        servicePayload(`${marker}_vinculado`, {
          resources: [{ resource_id: linked, unit_id: UA }],
          requirements: [],
        }),
      )
      assert.equal((await window(UA, linked, 'shift')).error, null)
      const args = {
        tenant: A,
        unit: UA,
        version_id: v.version_id,
        local_start: '2026-11-16T09:30',
        local_end: '2026-11-16T10:00',
      }
      assert.ok(
        (await a.rpc('catalog_availability', args)).data.some(
          (x) => x.id === linked,
        ),
      )
      sql(
        `update public.tenant_memberships set status='revoked' where id='${f.member}'`,
      )
      try {
        const result = await a.rpc('catalog_availability', args)
        assert.equal(result.error, null)
        assert.ok(!result.data.some((x) => x.id === linked))
        assert.equal(
          (await read('resources', a)).data.find((x) => x.id === linked)
            .eligible,
          false,
        )
      } finally {
        sql(
          `update public.tenant_memberships set status='active' where id='${f.member}'`,
        )
      }
    },
  )
  await t.test(
    'Revisão: seletor multiunidade, capacidade, nomeação e vínculo histórico',
    async () => {
      const team = await a.rpc('catalog_team_options', { tenant: A, unit: UA })
      assert.equal(team.error, null)
      assert.ok(team.data.some((x) => x.id === f.member))
      assert.equal(
        (
          await f.c.rpc('save_catalog_resource', {
            tenant: A,
            unit: UA,
            expected_version: 1,
            payload: resourcePayload(`${marker}_criacao`),
          })
        ).error.code,
        '22023',
      )
      assert.equal(
        (
          await f.c.rpc('publish_catalog_service', {
            tenant: A,
            unit: UA,
            expected_version: 1,
            payload: servicePayload(`${marker}_criacao`),
          })
        ).error.code,
        '22023',
      )
      const named = await f.resource(
        resourcePayload(`${marker}_sala_nomeada`, [UA], { kind: 'room' }),
      )
      const published = await f.service(
        servicePayload(`${marker}_sem_exigencia`, {
          resources: [{ resource_id: named, unit_id: UA }],
          requirements: [],
        }),
      )
      assert.equal(
        (await window(UA, named, 'shift', '16:00', '18:00')).error,
        null,
      )
      const avail = await f.c.rpc('catalog_availability', {
        tenant: A,
        unit: UA,
        local_start: '2026-11-16T16:10',
        local_end: '2026-11-16T16:40',
        version_id: published.version_id,
      })
      assert.equal(avail.error, null)
      assert.equal(
        avail.data.find((x) => x.id === named)?.available,
        true,
      )
      const trimmed = await f.service(
        servicePayload(`${marker}_espaco`, {
          resources: [{ resource_id: room, unit_id: UA }],
          requirements: [{ kind: 'room', capability: ' avaliacao ', quantity: 1 }],
        }),
      )
      assert.equal(
        sql(
          `select capability from private.catalog_requirements where version_id='${trimmed.version_id}'`,
        ),
        'avaliacao',
      )
      const blank = await f.c.rpc('set_catalog_window', {
        tenant: A,
        unit: UA,
        resource: named,
        kind: 'exception',
        local_start: '2026-11-16T18:00',
        local_end: '2026-11-16T19:00',
        reason: null,
      })
      assert.equal(blank.error, null)
      assert.equal(
        sql(`select reason from private.catalog_windows where id='${blank.data}'`),
        '',
      )
      const linked = await f.resource(
        resourcePayload(`${marker}_historico`, [UA], { membership_id: f.member }),
      )
      sql(
        `update public.tenant_memberships set status='revoked' where id='${f.member}'`,
      )
      try {
        assert.equal(
          (
            await a.rpc('save_catalog_resource', {
              tenant: A,
              unit: UA,
              resource: linked,
              expected_version: 1,
              payload: resourcePayload(`${marker}_historico`, [UA], {
                membership_id: f.member,
                active: true,
              }),
            })
          ).error.code,
          '22023',
        )
        assert.equal(
          (
            await a.rpc('save_catalog_resource', {
              tenant: A,
              unit: UA,
              resource: linked,
              expected_version: 1,
              payload: resourcePayload(`${marker}_historico`, [UA], {
                membership_id: f.member,
                active: false,
              }),
            })
          ).error,
          null,
        )
      } finally {
        sql(
          `update public.tenant_memberships set status='active' where id='${f.member}'`,
        )
      }
    },
  )
})
