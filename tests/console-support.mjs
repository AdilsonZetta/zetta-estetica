import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { client, localConfig } from './local-auth.mjs'
import { login } from './foundation-support.mjs'
export function sql(statement) {
  return execFileSync(
    'psql',
    [
      '-X',
      '-h',
      'localhost',
      '-p',
      '54322',
      '-U',
      'postgres',
      '-d',
      'zetta',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-c',
      statement
    ],
    { encoding: 'utf8' }
  ).trim()
}
export async function platformFixture() {
  const email = `console-${randomUUID()}@example.com`
  const admin = client(localConfig().service)
  const created = await admin.auth.admin.createUser({
    email,
    password: 'Demo@123456',
    email_confirm: true
  })
  assert.equal(created.error, null)
  const id = created.data.user.id
  // Preparação de autoridade exclusivamente na fixture local; verificações usam JWT público.
  sql(
    `insert into private.platform_memberships(user_id,role) values('${id}','superadmin')`
  )
  const c = await login(email)
  const tenants = []
  return {
    c,
    email,
    id,
    admin,
    tenants,
    async cleanup() {
      for (const t of tenants) {
        assert.match(t, /^[a-f0-9-]{36}$/)
        sql(
          `delete from private.invitation_delivery where tenant_id='${t}'; delete from public.module_changes where tenant_id='${t}'; delete from public.support_grants where tenant_id='${t}'; delete from public.module_test_records where tenant_id='${t}'; delete from public.tenant_invitations where tenant_id='${t}'; delete from public.membership_units where tenant_id='${t}'; delete from public.tenant_memberships where tenant_id='${t}'; delete from public.tenant_connections where tenant_id='${t}'; delete from public.tenant_configuration where tenant_id='${t}'; delete from public.tenant_subscriptions where tenant_id='${t}'; delete from public.tenant_entitlements where tenant_id='${t}'; delete from private.provision_requests where tenant_id='${t}'; delete from public.units where tenant_id='${t}'; delete from public.tenants where id='${t}'`
        )
      }
      sql(
        `delete from public.support_grants where grantee='${id}' or approver='${id}'; delete from public.module_changes where actor_id='${id}'`
      )
      assert.equal((await admin.auth.admin.deleteUser(id)).error, null)
    }
  }
}
export function provisionArgs(email) {
  return {
    request: randomUUID(),
    slug: `teste-${randomUUID()}`,
    name: 'Clínica sintética console',
    unit_name: 'Centro',
    brand: 'Marca sintética',
    responsible: 'Responsável sintético',
    email,
    plan: 'essential'
  }
}
