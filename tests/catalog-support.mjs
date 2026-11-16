import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { A, UA, UX, login } from './foundation-support.mjs'
import { sql } from './console-support.mjs'
import { client, localConfig } from './local-auth.mjs'
export const resourcePayload = (name, units = [UA], extra = {}) => ({
  kind: 'professional',
  name,
  qualification: 'Qualificação operacional sintética',
  capabilities: ['avaliacao'],
  units: units.map((unit_id) => ({
    unit_id,
    location: 'Sala sintética',
    capacity: 1,
  })),
  ...extra,
})
export const servicePayload = (name, extra = {}) => ({
  name,
  category: 'Avaliação',
  duration_minutes: 30,
  buffer_before: 5,
  buffer_after: 10,
  price_cents: 15000,
  currency: 'BRL',
  state: 'published',
  units: [UA],
  resources: [],
  requirements: [
    { kind: 'room', capability: 'avaliacao', quantity: 1 },
    { kind: 'equipment', capability: 'avaliacao', quantity: 1 },
  ],
  ...extra,
})
export async function catalogFixture(t) {
  const admin = client(localConfig().service),
    email = `catalog-${randomUUID()}@example.com`
  const created = await admin.auth.admin.createUser({
    email,
    password: 'Demo@123456',
    email_confirm: true,
  })
  assert.equal(created.error, null)
  const user = created.data.user.id,
    member = randomUUID(),
    resources = [],
    services = []
  sql(
    `insert into public.tenant_memberships(id,tenant_id,user_id,role,status) values('${member}','${A}','${user}','manager','active'); insert into public.membership_units(tenant_id,membership_id,unit_id) values('${A}','${member}','${UA}'),('${A}','${member}','${UX}')`,
  )
  t.after(async () => {
    for (const id of services)
      sql(
        `delete from private.catalog_service_resources where version_id in (select id from private.catalog_service_versions where service_id='${id}'); delete from private.catalog_requirements where version_id in (select id from private.catalog_service_versions where service_id='${id}'); delete from private.catalog_service_units where version_id in (select id from private.catalog_service_versions where service_id='${id}'); delete from private.catalog_service_versions where service_id='${id}'; delete from private.catalog_services where id='${id}'`,
      )
    for (const id of resources)
      sql(
        `delete from private.catalog_windows where resource_id='${id}'; delete from private.catalog_resource_units where resource_id='${id}'; delete from private.catalog_resources where id='${id}'`,
      )
    await admin.auth.admin.deleteUser(user)
  })
  const c = await login(email)
  return {
    c,
    member,
    resources,
    services,
    async resource(payload) {
      const r = await c.rpc('save_catalog_resource', {
        tenant: A,
        unit: UA,
        payload,
      })
      assert.equal(r.error, null)
      resources.push(r.data)
      return r.data
    },
    async service(payload) {
      const r = await c.rpc('publish_catalog_service', {
        tenant: A,
        unit: UA,
        payload,
      })
      assert.equal(r.error, null)
      const sid = sql(
        `select service_id from private.catalog_service_versions where id='${r.data}'`,
      )
      services.push(sid)
      return { id: sid, version_id: r.data }
    },
  }
}
