import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, createDemoUsers, expiredSession, localConfig } from './local-auth.mjs'

test('Auth real local com duas identidades sintéticas (não valida memberships)', async t => {
  const fixture = await createDemoUsers()
  t.after(fixture.cleanup)
  const [a, b] = [client(), client()]
  let sessionA, sessionB
  await t.test('login A e B com identidades distintas', async () => {
    const results = await Promise.all([a.auth.signInWithPassword(fixture.users[0]), b.auth.signInWithPassword(fixture.users[1])])
    assert.equal(results[0].error, null); assert.equal(results[1].error, null)
    sessionA = results[0].data.session; sessionB = results[1].data.session
    assert.notEqual(sessionA.user.id, sessionB.user.id)
  })
  await t.test('consulta de identidade pelo servidor usa sessão de usuário', async () => {
    assert.equal((await a.auth.getUser()).data.user.id, fixture.users[0].id)
    assert.equal((await b.auth.getUser()).data.user.id, fixture.users[1].id)
  })
  await t.test('senha inválida é rejeitada', async () => {
    const { error } = await client().auth.signInWithPassword({ email: fixture.users[0].email, password: 'invalida' })
    assert.ok(error)
    assert.equal(error.status, 400)
  })
  await t.test('JWT assinado expirado é rejeitado pelo Auth (sem esperar relógio)', async () => {
    const config = localConfig()
    const expired = expiredSession(sessionA)
    const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.anon, Authorization: `Bearer ${expired.access_token}` } })
    assert.ok([401, 403].includes(response.status))
    const body = await response.json()
    assert.equal(body.error_code, 'bad_jwt')
    assert.match(body.msg, /token is expired/)
  })
  await t.test('renovação da sessão funciona com refresh token real', async () => {
    const { data, error } = await a.auth.refreshSession()
    assert.equal(error, null); assert.equal(data.user.id, fixture.users[0].id)
    sessionA = data.session
  })
  await t.test('logout revoga refresh A e preserva identidade B', async () => {
    const refresh = sessionA.refresh_token
    assert.equal((await a.auth.signOut()).error, null)
    assert.equal((await a.auth.getSession()).data.session, null)
    assert.ok((await client().auth.refreshSession({ refresh_token: refresh })).error)
    assert.equal((await b.auth.getUser()).data.user.id, sessionB.user.id)
    assert.equal((await b.auth.signOut()).error, null)
  })
})
