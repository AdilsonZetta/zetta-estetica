import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { client, localConfig } from './local-auth.mjs'
import { sql } from './console-support.mjs'
import { A, B, UA, login, invitedFixture } from './foundation-support.mjs'

test('Launch e códigos Auth reais, sem transporte SMTP', async (t) => {
  const [a, b, multi] = await Promise.all(
    ['a@example.com', 'b@example.com', 'multi@example.com'].map(login)
  )
  await t.test(
    'destino é resolvido no servidor sem confiar na conta FLW ou slug',
    async () => {
      assert.deepEqual(
        (await a.rpc('launch_context')).data.map((v) => v.id),
        [A]
      )
      assert.deepEqual(
        (await b.rpc('launch_context', { destination: 'clinica-aurora' })).data,
        []
      )
      assert.equal((await multi.rpc('launch_context')).data.length, 2)
      assert.deepEqual(
        (await client().rpc('launch_context')).error.code,
        '42501'
      )
    }
  )
  await t.test(
    'OTP desconhecido com shouldCreateUser false não cria identidade',
    async () => {
      const email = `otp-desconhecido-${randomUUID()}@example.com`
      const result = await client().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      })
      assert.ok(result.error)
      assert.equal(result.error.code, 'otp_disabled')
    }
  )
  await t.test(
    'código de e-mail autentica conta existente e é de uso único',
    async () => {
      // Admin somente gera material Auth da fixture, nunca autoriza a operação.
      const f = await invitedFixture(t, a)
      const admin = client(localConfig().service)
      const generated = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: f.email
      })
      assert.equal(generated.error, null)
      const c = client()
      assert.equal(
        (
          await c.auth.verifyOtp({
            email: f.email,
            token: generated.data.properties.email_otp,
            type: 'email'
          })
        ).error,
        null
      )
      assert.equal(
        (await c.rpc('accept_invitation', { invitation: f.id })).error,
        null
      )
      assert.deepEqual(
        (await c.rpc('launch_context')).data.map((v) => v.id),
        [A]
      )
      assert.ok(
        (
          await client().auth.verifyOtp({
            email: f.email,
            token: generated.data.properties.email_otp,
            type: 'email'
          })
        ).error
      )
    }
  )
  await t.test('convites pendentes expirados e revogados não criam vínculo com sessão válida', async () => {
    const expired = await invitedFixture(t,a)
    sql(`update public.tenant_invitations set expires_at=now()-interval '1 second' where id='${expired.id}'`)
    assert.equal((await expired.invited.rpc('accept_invitation',{invitation:expired.id})).error?.code,'42501')
    assert.deepEqual((await expired.invited.rpc('launch_context')).data,[])
    const revoked = await invitedFixture(t,a)
    assert.equal((await a.rpc('revoke_invitation',{tenant:A,invitation:revoked.id})).error,null)
    assert.equal((await revoked.invited.rpc('accept_invitation',{invitation:revoked.id})).error?.code,'42501')
    assert.deepEqual((await revoked.invited.rpc('launch_context')).data,[])
  })
  await t.test('código Auth expirado é recusado pelo GoTrue real', async () => {
    const f = await invitedFixture(t, a)
    const admin = client(localConfig().service)
    const generated = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: f.email
    })
    assert.equal(generated.error, null)
    // Preparação temporal da fixture local; verificação usa apenas chave pública.
    sql(
      `update auth.users set recovery_sent_at=now()-interval '100 years', confirmation_sent_at=now()-interval '100 years' where id='${f.user.id}'; update auth.one_time_tokens set expires_at=now()-interval '1 second', created_at=now()-interval '100 years' where user_id='${f.user.id}'`
    )
    const result = await client().auth.verifyOtp({
      email: f.email,
      token: generated.data.properties.email_otp,
      type: 'email'
    })
    assert.equal(result.error?.code, 'otp_expired')
    assert.equal(result.data.session, null)
  })
  await t.test(
    'código de convite autentica, convite encaminhado não vincula outra identidade',
    async () => {
      const email = `codigo-convite-${randomUUID()}@example.com`
      const inv = await a.rpc('invite_member', {
        tenant: A,
        unit: UA,
        email,
        clinic_role: 'manager'
      })
      assert.equal(inv.error, null)
      const admin = client(localConfig().service)
      const generated = await admin.auth.admin.generateLink({
        type: 'invite',
        email
      })
      assert.equal(generated.error, null)
      t.after(async () =>
        assert.equal(
          (await admin.auth.admin.deleteUser(generated.data.user.id)).error,
          null
        )
      )
      assert.equal(
        (await b.rpc('accept_invitation', { invitation: inv.data })).error.code,
        '42501'
      )
      const c = client()
      assert.ok(
        (await c.auth.verifyOtp({ email, token: '0000000000', type: 'invite' }))
          .error
      )
      assert.equal(
        (
          await c.auth.verifyOtp({
            email,
            token: generated.data.properties.email_otp,
            type: 'invite'
          })
        ).error,
        null
      )
      const accepted = await c.rpc('accept_invitation', {
        invitation: inv.data
      })
      assert.equal(accepted.error, null)
      assert.equal(
        (await c.rpc('accept_invitation', { invitation: inv.data })).data,
        accepted.data
      )
      assert.equal(
        (
          await a.rpc('revoke_membership', {
            tenant: A,
            membership: accepted.data
          })
        ).error,
        null
      )
      assert.deepEqual((await c.rpc('launch_context')).data, [])
      assert.equal(
        (await c.rpc('accept_invitation', { invitation: inv.data })).error.code,
        '42501'
      )
      assert.deepEqual(
        (await b.rpc('launch_context')).data.map((v) => v.id),
        [B]
      )
    }
  )
})
