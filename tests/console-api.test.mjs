import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { A, B, UA, UB, login, access } from './foundation-support.mjs'
import { client } from './local-auth.mjs'
import { platformFixture, provisionArgs, sql } from './console-support.mjs'

test('Console real: provisionamento, contrato, convite e suporte', async (t) => {
  const f = await platformFixture()
  t.after(() => f.cleanup())
  const a = await login('a@example.com'),
    b = await login('b@example.com')
  await t.test('A/B: RLS e RPC aplicam os mesmos direitos', async () => {
    assert.equal(await access(a, A, UA, 'agenda.test', 'agenda'), true)
    assert.equal(await access(a, A, UA, 'packages.test', 'packages'), true)
    assert.equal(await access(b, B, UB, 'agenda.test', 'agenda'), true)
    assert.equal(await access(b, B, UB, 'packages.test', 'packages'), false)
    assert.equal(
      (await b.rpc('module_probe', { tenant: B, unit: UB, module: 'packages' }))
        .error?.code,
      '42501'
    )
    const ar = await a.from('module_test_records').select('*'),
      br = await b.from('module_test_records').select('*')
    assert.deepEqual(ar.data.map((r) => r.module_key).sort(), [
      'agenda',
      'packages'
    ])
    assert.deepEqual(
      br.data.map((r) => r.module_key),
      ['agenda']
    )
  })
  await t.test(
    'Admin clínico não provisiona, altera assinatura ou quota',
    async () => {
      assert.equal((await a.rpc('console_snapshot')).error?.code, '42501')
      assert.equal(
        (await a.rpc('provision_tenant', provisionArgs('x@example.com'))).error
          ?.code,
        '42501'
      )
      assert.equal(
        (
          await a.rpc('update_subscription', {
            tenant: A,
            state: 'active',
            unit_limit: 999,
            reason: 'Escalada sintética'
          })
        ).error?.code,
        '42501'
      )
    }
  )
  const email = `inicial-${randomUUID()}@example.com`,
    args = provisionArgs(email)
  let tenant, invitation, unit
  await t.test(
    'Provisionamento idempotente não duplica tenant, unidade ou convite',
    async () => {
      const r = await f.c.rpc('provision_tenant', args)
      assert.equal(r.error, null)
      tenant = r.data
      f.tenants.push(tenant)
      const retries = await Promise.all(
        Array.from({ length: 5 }, () => f.c.rpc('provision_tenant', args))
      )
      for (const rr of retries) {
        assert.equal(rr.error, null)
        assert.equal(rr.data, tenant)
      }
      const snapshot = await f.c.rpc('console_snapshot')
      assert.equal(snapshot.error, null)
      const row = snapshot.data.tenants.find((t) => t.id === tenant)
      assert.equal(row.units.length, 1)
      assert.equal(row.invitations.length, 1)
      invitation = row.invitations[0].id
      unit = row.units[0].id
      assert.equal(
        (
          await f.c.rpc('provision_tenant', {
            ...args,
            name: 'Dado divergente'
          })
        ).error?.code,
        '22023'
      )
    }
  )
  await t.test('Falha transacional não deixa tenant parcial', async () => {
    const invalid = provisionArgs('falha@example.com')
    invalid.plan = 'inexistente'
    assert.equal(
      (await f.c.rpc('provision_tenant', invalid)).error?.code,
      '23503'
    )
    assert.equal(
      sql(`select count(*) from public.tenants where slug='${invalid.slug}'`),
      '0'
    )
  })
  let invited, membership
  await t.test(
    'Convite inicial exige e-mail confirmado; aceite único e retry',
    async () => {
      const link = await f.admin.auth.admin.generateLink({
        type: 'invite',
        email
      })
      assert.equal(link.error, null)
      t.after(async () =>
        assert.equal(
          (await f.admin.auth.admin.deleteUser(link.data.user.id)).error,
          null
        )
      )
      invited = client()
      assert.equal(
        (
          await invited.auth.verifyOtp({
            type: 'invite',
            token_hash: link.data.properties.hashed_token
          })
        ).error,
        null
      )
      sql(
        `update auth.users set email_confirmed_at=null where id='${link.data.user.id}'`
      )
      assert.equal(
        (await invited.rpc('accept_invitation', { invitation })).error?.code,
        '42501'
      )
      sql(
        `update auth.users set email_confirmed_at=now() where id='${link.data.user.id}'`
      )
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          invited.rpc('accept_invitation', { invitation })
        )
      )
      for (const r of results) assert.equal(r.error, null)
      membership = results[0].data
      assert.equal(new Set(results.map((r) => r.data)).size, 1)
      assert.equal(await access(invited, tenant, unit), true)
    }
  )
  await t.test(
    'Mudança de escopo audita e FK composta impede unidade de outra clínica',
    async () => {
      const second = await f.c.rpc('add_tenant_unit', {
        tenant,
        name: 'Filial sintética'
      })
      assert.equal(second.error, null)
      assert.equal(await access(invited, tenant, second.data), false)
      assert.equal(
        (
          await f.c.rpc('set_member_scope', {
            tenant,
            membership,
            units: [unit, second.data],
            reason: 'Ampliação de escopo autorizada'
          })
        ).error,
        null
      )
      assert.equal(await access(invited, tenant, second.data), true)
      assert.equal(
        (
          await f.c.rpc('set_member_scope', {
            tenant,
            membership,
            units: [UB],
            reason: 'Tentativa de unidade cruzada'
          })
        ).error?.code,
        '23503'
      )
      assert.equal(await access(invited, tenant, second.data), true)
      assert.equal(
        (
          await f.c.rpc('set_member_scope', {
            tenant,
            membership,
            units: [unit],
            reason: 'Retorno ao escopo original'
          })
        ).error,
        null
      )
      assert.equal(await access(invited, tenant, second.data), false)
      const snap = await f.c.rpc('console_snapshot')
      assert.ok(
        snap.data.audit.some(
          (a) => a.tenant_id === tenant && a.action === 'scope'
        )
      )
    }
  )
  await t.test(
    'Retry de envio: falha, novo lease, sucesso e ausência de duplicação',
    async () => {
      const r = await invited.rpc('invite_member', {
        tenant,
        unit,
        email: `retry-${randomUUID()}@example.com`,
        clinic_role: 'reception'
      })
      assert.equal(r.error, null)
      const invitation = r.data
      const queue = () =>
        invited.rpc('request_invitation_delivery', { invitation })
      assert.equal((await queue()).data, 'pending')
      assert.equal(
        (await invited.rpc('claim_invitation_delivery', { invitation })).error
          ?.code,
        '42501'
      )
      // Emula claims do worker SQL para testar a máquina de estados; não afirma entrega SMTP.
      const claim = () =>
        JSON.parse(
          sql(
            `begin; set local role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',true); select public.claim_invitation_delivery('${invitation}'); commit;`
          )
            .split('\n')
            .find((x) => x.startsWith('{"email"')) || 'null'
        )
      const first = claim()
      assert.ok(first.lease)
      assert.equal(claim(), null)
      sql(
        `begin;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select public.finish_invitation_delivery('${invitation}','${first.lease}',false);commit;`
      )
      assert.equal((await queue()).data, 'pending')
      const second = claim()
      assert.notEqual(second.lease, first.lease)
      sql(
        `begin;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select public.finish_invitation_delivery('${invitation}','${second.lease}',true);commit;`
      )
      assert.equal((await queue()).data, 'sent')
      assert.equal(claim(), null)
      assert.equal(
        sql(
          `select attempts from private.invitation_delivery where invitation_id='${invitation}'`
        ),
        '2'
      )
    }
  )
  await t.test(
    'Conexão e ícone preservam capacidade não comprovada',
    async () => {
      assert.equal((await f.c.rpc('test_connection', { tenant })).error, null)
      assert.equal(
        (
          await f.c.rpc('configure_icon', {
            tenant,
            account_label: 'Conta sintética manual',
            return_url: 'https://flw.example.invalid/conta'
          })
        ).error,
        null
      )
      const snap = await f.c.rpc('console_snapshot')
      const c = snap.data.tenants.find((t) => t.id === tenant).connection
      assert.equal(c.test_state, 'blocked')
      assert.equal(c.capability_state, 'CAPABILITY_NOT_VERIFIED')
      assert.equal(c.icon_state, 'awaiting_validation')
      assert.ok(c.last_test_at)
    }
  )
  await t.test(
    'Plano, override e dependência são revalidados no banco',
    async () => {
      assert.equal(
        (
          await f.c.rpc('set_tenant_plan', {
            tenant,
            plan: 'complete',
            reason: 'Upgrade sintético contratado'
          })
        ).error,
        null
      )
      assert.equal(
        await access(invited, tenant, unit, 'packages.test', 'packages'),
        true
      )
      assert.equal(
        (
          await f.c.rpc('set_tenant_plan', {
            tenant,
            plan: 'essential',
            reason: 'Downgrade sintético contratado'
          })
        ).error,
        null
      )
      assert.equal(
        await access(invited, tenant, unit, 'packages.test', 'packages'),
        false
      )
      assert.equal(
        (
          await f.c.rpc('set_module_override', {
            tenant,
            module: 'packages',
            enabled: true,
            until_at: new Date(Date.now() + 3600000).toISOString(),
            reason: 'Addon sintético contratado'
          })
        ).error,
        null
      )
      assert.equal(
        await access(invited, tenant, unit, 'packages.test', 'packages'),
        true
      )
    }
  )
  await t.test(
    'Suspensão bloqueia usuário e jobs; exportação exige concessão e contrato',
    async () => {
      assert.equal(
        (
          await f.c.rpc('set_tenant_status', {
            tenant,
            suspended: true,
            reason: 'Suspensão sintética contratual',
            export_until: new Date(Date.now() + 3600000).toISOString()
          })
        ).error,
        null
      )
      assert.equal(await access(invited, tenant, unit), false)
      assert.equal(
        (await invited.rpc('module_probe', { tenant, unit, module: 'agenda' }))
          .error?.code,
        '42501'
      )
      assert.equal(sql(`select private.job_allowed('${tenant}','agenda')`), 'f')
      assert.equal(
        (await invited.rpc('export_tenant_metadata', { tenant })).error?.code,
        '42501'
      )
      const user = (await invited.auth.getUser()).data.user.id
      assert.equal(
        (
          await f.c.rpc('grant_support', {
            tenant,
            grantee: user,
            scope: 'export',
            minutes: 15,
            reason: 'Autorização contratual sintética'
          })
        ).error,
        null
      )
      assert.equal(
        (await invited.rpc('export_tenant_metadata', { tenant })).data.units
          .length,
        1
      )
      assert.equal(
        (
          await f.c.rpc('set_tenant_status', {
            tenant,
            suspended: false,
            reason: 'Reativação sintética autorizada'
          })
        ).error,
        null
      )
      assert.equal(await access(invited, tenant, unit), true)
    }
  )
  await t.test(
    'Diagnóstico requer concessão; retorna somente campos redigidos e revoga',
    async () => {
      assert.equal(
        (await f.c.rpc('support_diagnostics', { tenant })).error?.code,
        '42501'
      )
      const g = await f.c.rpc('grant_support', {
        tenant,
        grantee: f.id,
        scope: 'diagnostics',
        minutes: 15,
        reason: 'Incidente sintético autorizado'
      })
      assert.equal(g.error, null)
      const d = await f.c.rpc('support_diagnostics', { tenant })
      assert.equal(d.error, null)
      assert.deepEqual(Object.keys(d.data).sort(), [
        'capability_state',
        'last_test_at',
        'pending_deliveries',
        'status',
        'tenant_id',
        'test_state'
      ])
      assert.equal(
        (await f.c.rpc('revoke_support', { grant_id: g.data })).error,
        null
      )
      assert.equal(
        (await f.c.rpc('support_diagnostics', { tenant })).error?.code,
        '42501'
      )
    }
  )
})
