import { test } from 'node:test'
import assert from 'node:assert/strict'
import { A, UA, login, invitedFixture, access } from './foundation-support.mjs'

test('Concorrência real: aceite idempotente e revogação de vínculo', async t => {
  const a=await login('a@example.com')
  const f=await invitedFixture(t,a)
  const results=await Promise.all(Array.from({length:12},()=>f.invited.rpc('accept_invitation',{invitation:f.id})))
  for (const r of results) assert.equal(r.error,null)
  assert.equal(new Set(results.map(r=>r.data)).size,1)
  const mid=results[0].data
  const memberships=await a.from('tenant_memberships').select('id').eq('tenant_id',A).eq('user_id',f.user.id)
  assert.equal(memberships.data.length,1)
  const units=await a.from('membership_units').select('*').eq('membership_id',mid)
  assert.equal(units.data.length,1)
  assert.equal(await access(f.invited,A,UA),true)
  const revocations=await Promise.all(Array.from({length:6},()=>a.rpc('revoke_membership',{tenant:A,membership:mid})))
  for (const r of revocations) assert.equal(r.error,null)
  assert.equal(await access(f.invited,A,UA),false)
  const retries=await Promise.all(Array.from({length:6},()=>f.invited.rpc('accept_invitation',{invitation:f.id})))
  for (const r of retries) assert.equal(r.error?.code,'42501')
  assert.equal(await access(f.invited,A,UA),false)
})


test('Convites distintos concorrentes para a mesma identidade não vazam unicidade', async t => {
  const a=await login('a@example.com')
  const f=await invitedFixture(t,a)
  const second=await a.rpc('invite_member',{tenant:A,unit:UA,email:f.email,clinic_role:'manager'})
  assert.equal(second.error,null)
  const results=await Promise.all([f.id,second.data].map(invitation=>f.invited.rpc('accept_invitation',{invitation})))
  assert.equal(results.filter(r=>r.error===null).length,1)
  assert.equal(results.find(r=>r.error)?.error.code,'42501')
})
