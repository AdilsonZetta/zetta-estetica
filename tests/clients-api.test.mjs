import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { A, B, UA, UB, UX, login } from './foundation-support.mjs'
import { sql } from './console-support.mjs'
import { client } from './local-auth.mjs'

test('Clientes: cadastro, identidade, vínculo e merge com sessões reais', async (t) => {
  const [a, b, z, revoked] = await Promise.all(
    [
      'a@example.com',
      'b@example.com',
      'zetta@example.com',
      'revogado@example.com'
    ].map(login)
  )
  const marker = `cliente_${randomUUID()}`,
    ids = []
  const create = async (db, tenant, unit, extra = {}) => {
    const r = await db.rpc('save_client', {
      tenant,
      unit,
      name: marker,
      ...extra
    })
    assert.equal(r.error, null)
    ids.push(r.data)
    return r.data
  }
  t.after(() => {
    if (ids.length)
      sql(
        `delete from private.client_events where client_id in ('${ids.join("','")}'); delete from private.client_links where client_id in ('${ids.join("','")}'); delete from private.clients where id in ('${ids.join("','")}')`
      )
  })
  const first = await create(a, A, UA, { phone: '(11) 99999-4321' }),
    other = await create(b, B, UB, { phone: '(11) 99999-4321' })
  const detail = async (id) => {
    const r = await a.rpc('client_detail', { tenant: A, unit: UA, client: id })
    assert.equal(r.error, null)
    return r.data
  }
  let second, link
  await t.test(
    'Homônimo/telefone compartilhado exige revisão; não há fusão automática',
    async () => {
      assert.equal(
        (
          await a.rpc('save_client', {
            tenant: A,
            unit: UA,
            name: marker,
            phone: '(11) 99999-4321'
          })
        ).error?.code,
        '22023'
      )
      second = await create(a, A, UA, {
        phone: '(11) 99999-4321',
        reviewed: true
      })
      assert.notEqual(first, second)
      assert.notEqual(first, other)
      assert.equal((await detail(first)).client.phone_e164, '+5511999994321')
      const r = await a.rpc('search_clients', {
        tenant: A,
        unit: UA,
        query: '999994321'
      })
      assert.equal(r.error, null)
      assert.ok(r.data.some((x) => x.id === first))
      assert.ok(!r.data.some((x) => x.id === other))
      const trimmed = await a.rpc('search_clients', {
        tenant: A,
        unit: UA,
        query: `  ${marker}  `
      })
      assert.equal(trimmed.error, null)
      assert.ok(trimmed.data.some((x) => x.id === first))
    }
  )
  await t.test(
    'Dados incompletos e mudança de número; edição obsoleta recusada',
    async () => {
      assert.equal(
        (await a.rpc('save_client', { tenant: A, unit: UA, name: '' })).error
          ?.code,
        '22023'
      )
      assert.equal(
        (
          await a.rpc('save_client', {
            tenant: A,
            unit: UA,
            name: 'Incompleto',
            phone: '123'
          })
        ).error?.code,
        '22023'
      )
      const incomplete = await create(a, A, UA, {
        name: `${marker}_incompleto`,
        phone: '123',
        reviewed: true
      })
      assert.equal((await detail(incomplete)).client.phone_e164, null)
      const r = await a.rpc('save_client', {
        tenant: A,
        unit: UA,
        client: first,
        expected_version: 1,
        name: marker,
        phone: '+351 912 345 678',
        reviewed: true
      })
      assert.equal(r.error, null)
      assert.equal((await detail(first)).client.phone_e164, '+351912345678')
      assert.equal(
        (
          await a.rpc('save_client', {
            tenant: A,
            unit: UA,
            client: first,
            expected_version: 1,
            name: marker
          })
        ).error?.code,
        '40001'
      )
    }
  )
  await t.test(
    'Isolamento de tenant, unidade, revogado, global e anônimo; tabelas sem acesso',
    async () => {
      for (const [db, tenant, unit] of [
        [b, A, UA],
        [a, B, UB],
        [a, A, UX],
        [z, A, UA],
        [revoked, A, UA],
        [client(), A, UA]
      ]) {
        for (const [rpc, args] of [
          ['search_clients', {}],
          ['client_detail', { client: first }],
          ['save_client', { name: 'Negado' }],
          ['preview_client_import', { rows: [] }],
          [
            'set_client_link',
            {
              client: first,
              kind: 'card',
              reference: 'negado',
              source: 'teste'
            }
          ],
          [
            'merge_clients',
            {
              source: first,
              survivor: second,
              source_version: 2,
              survivor_version: 1,
              reason: 'negado',
              confirmed: true
            }
          ]
        ])
          assert.equal(
            (await db.rpc(rpc, { tenant, unit, ...args })).error?.code,
            '42501',
            rpc
          )
      }
      assert.ok((await a.schema('private').from('clients').select()).error)
      assert.equal(
        (await a.rpc('client_detail', { tenant: A, unit: UA, client: other }))
          .error?.code,
        '22023'
      )
    }
  )
  await t.test(
    'Vínculo tipado duplicado recusado; revisão e encerramento preservam histórico; sem deep link',
    async () => {
      const args = {
        tenant: A,
        unit: UA,
        client: first,
        kind: 'card',
        reference: marker,
        source: 'registro_sintetico'
      }
      const r = await a.rpc('set_client_link', args)
      assert.equal(r.error, null)
      link = r.data
      assert.equal(
        (await a.rpc('set_client_link', { ...args, client: second })).error
          ?.code,
        '23505'
      )
      assert.equal(
        (
          await a.rpc('set_client_link', {
            ...args,
            link,
            expected_version: (await detail(first)).client.version,
            link_state: 'confirmed'
          })
        ).error,
        null
      )
      for (const expected_version of [undefined, 1]) {
        const stale = await a.rpc('set_client_link', {
          ...args,
          link,
          expected_version,
          link_state: 'retired'
        })
        assert.equal(stale.error?.code, '40001')
      }
      const d = await detail(first)
      assert.equal(d.crm_url, null)
      assert.equal(d.crm_code, 'CAPABILITY_NOT_VERIFIED')
      assert.equal(d.links[0].state, 'confirmed')
      assert.equal(d.links[0].mode, 'manual')
      assert.equal(
        (
          await b.rpc('set_client_link', {
            ...args,
            tenant: B,
            unit: UB,
            client: other
          })
        ).error,
        null
      )
      assert.equal(
        (
          await a.rpc('set_client_link', {
            ...args,
            link,
            expected_version: (await detail(first)).client.version,
            link_state: 'retired'
          })
        ).error,
        null
      )
      assert.equal((await detail(first)).links[0].state, 'retired')
      assert.equal(
        (
          await a.rpc('set_client_link', {
            ...args,
            link,
            expected_version: (await detail(first)).client.version,
            link_state: 'confirmed'
          })
        ).error,
        null
      )
      assert.ok(
        (await detail(first)).history.some(
          (h) => h.effects.previous?.state === 'retired'
        )
      )

      assert.equal(
        (
          await a.rpc('set_client_link', {
            ...args,
            reference: 'https://evil.invalid'
          })
        ).error?.code,
        '22023'
      )
      assert.equal(
        (await a.rpc('set_client_link', { ...args, client: second, link }))
          .error?.code,
        '22023'
      )
    }
  )
  await t.test(
    'Merge falho é atômico; merge revisado move só vínculos, arquiva e é idempotente',
    async () => {
      const s = (await detail(first)).client,
        d = (await detail(second)).client
      const args = {
        tenant: A,
        unit: UA,
        source: first,
        survivor: second,
        source_version: s.version,
        survivor_version: d.version,
        reason: 'Duplicidade revisada pela clínica',
        confirmed: true
      }
      assert.equal(
        (await a.rpc('merge_clients', { ...args, survivor: other })).error
          ?.code,
        '22023'
      )
      assert.equal(
        (await a.rpc('merge_clients', { ...args, confirmed: false })).error
          ?.code,
        '22023'
      )
      assert.equal(
        (await a.rpc('merge_clients', { ...args, source_version: 1 })).error
          ?.code,
        '40001'
      )
      assert.equal((await detail(first)).client.state, 'active')
      assert.equal((await detail(first)).links[0].id, link)
      const r = await a.rpc('merge_clients', args)
      assert.equal(r.error, null)
      assert.equal(r.data.moved_links, 1)
      const repeat = await a.rpc('merge_clients', args)
      assert.equal(repeat.error, null)
      assert.deepEqual(repeat.data, r.data)
      for (const versions of [
        { source_version: s.version + 1 },
        { survivor_version: d.version + 1 },
        { source_version: null }
      ]) {
        assert.equal(
          (await a.rpc('merge_clients', { ...args, ...versions })).error?.code,
          '22023'
        )
      }
      // Replay da mesma operação continua válido após edição posterior do sobrevivente.
      assert.equal(
        (
          await a.rpc('save_client', {
            tenant: A,
            unit: UA,
            client: second,
            expected_version: d.version + 1,
            name: marker,
            reviewed: true
          })
        ).error,
        null
      )
      assert.deepEqual((await a.rpc('merge_clients', args)).data, r.data)
      assert.equal((await detail(first)).client.merged_into, second)
      assert.equal((await detail(first)).links.length, 0)
      const after = await detail(second)
      assert.equal(after.links[0].id, link)
      assert.ok(
        after.history.some(
          (x) => x.client_id === first && x.action === 'client_link_reviewed'
        )
      )
      assert.ok(after.history.some((x) => x.action === 'client_merge_received'))
      assert.equal(
        (
          await a.rpc('save_client', {
            tenant: A,
            unit: UA,
            client: first,
            expected_version: s.version + 1,
            name: marker
          })
        ).error?.code,
        '22023'
      )
    }
  )
  await t.test(
    'Prévia v1 sem gravação: ambiguidade no banco/lote e rejeições com linha e origem',
    async () => {
      const count = sql(`select count(*) from private.clients`)
      const r = await a.rpc('preview_client_import', {
        tenant: A,
        unit: UA,
        rows: [
          { name: marker, phone: '(11) 99999-4321', source_ref: 'origem1' },
          { name: '', phone: '123', source_ref: 'origem2' },
          { name: 'Mesmo nome na amostra', source_ref: 'origem3' },
          { name: 'Mesmo nome na amostra', source_ref: 'origem4' },
          { name: 'Novo sintético', source_ref: 'origem5', role: 'admin' }
        ]
      })
      assert.equal(r.error, null)
      assert.equal(r.data.dry_run, true)
      assert.equal(r.data.rejected, 2)
      assert.equal(r.data.review, 3)
      const malformed = await a.rpc('preview_client_import', {
        tenant: A,
        unit: UA,
        rows: [{ name: 42, phone: 11999994321, source_ref: 'tipo_invalido' }]
      })
      assert.equal(malformed.error, null)
      assert.equal(malformed.data.rejected, 1)
      const origin = await a.rpc('preview_client_import', {
        tenant: A,
        unit: UA,
        rows: [
          { name: 'Origem repetida A', source_ref: 'duplicada' },
          { name: 'Origem repetida B', source_ref: 'duplicada' }
        ]
      })
      assert.equal(origin.error, null)
      assert.equal(origin.data.review, 2)
      const emails = await a.rpc('preview_client_import', {
        tenant: A,
        unit: UA,
        rows: [
          {
            name: 'Email lote A',
            email: '  Amostra@example.com ',
            source_ref: 'email_a'
          },
          {
            name: 'Email lote B',
            email: 'amostra@example.com',
            source_ref: 'email_b'
          },
          { name: 'Sem email A', source_ref: 'sem_email_a' },
          { name: 'Sem email B', email: '', source_ref: 'sem_email_b' }
        ]
      })
      assert.equal(emails.error, null)
      assert.deepEqual(
        emails.data.rows.map((x) => x.status),
        ['review', 'review', 'new', 'new']
      )

      assert.equal(r.data.rows[0].candidates.length, 1)
      assert.equal(r.data.rows[1].line, 2)
      assert.equal(r.data.rows[1].source_ref, 'origem2')
      assert.equal(sql('select count(*) from private.clients'), count)
      assert.equal(
        (
          await a.rpc('preview_client_import', {
            tenant: A,
            unit: UA,
            rows: Array(101).fill({})
          })
        ).error?.code,
        '22023'
      )
    }
  )
})
