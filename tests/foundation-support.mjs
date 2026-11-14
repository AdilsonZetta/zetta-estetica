import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { client, localConfig } from './local-auth.mjs'
export const A = '10000000-0000-0000-0000-000000000001'
export const B = '20000000-0000-0000-0000-000000000001'
export const UA = '10000000-0000-0000-0000-000000000011'
export const UX = '10000000-0000-0000-0000-000000000012'
export const UB = '20000000-0000-0000-0000-000000000011'
export async function login(email) {
  const c = client()
  const result = await c.auth.signInWithPassword({ email, password: 'Demo@123456' })
  assert.equal(result.error, null)
  return c
}
export async function invitedFixture(t, a) {
  const email = `convite-${randomUUID()}@example.com`
  const invitation = await a.rpc('invite_member', { tenant: A, unit: UA, email, clinic_role: 'manager' })
  assert.equal(invitation.error, null)
  // API Admin SOMENTE para preparar a identidade convidada; verificações usam a sessão pública.
  const admin = client(localConfig().service)
  const link = await admin.auth.admin.generateLink({ type: 'invite', email })
  assert.equal(link.error, null)
  const user = link.data.user
  t.after(async () => {
    const clean = await admin.auth.admin.deleteUser(user.id)
    assert.equal(clean.error, null)
  })
  const invited = client()
  const verified = await invited.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'invite' })
  assert.equal(verified.error, null)
  return { invited, id: invitation.data, user, email }
}
export async function access(c, tenant, unit, permission = 'unit.read', module = 'core') {
  const result = await c.rpc('check_access', { tenant, unit, permission, module })
  assert.equal(result.error, null)
  return result.data
}
