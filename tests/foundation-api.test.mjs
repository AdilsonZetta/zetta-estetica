import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, localConfig } from './local-auth.mjs'
import { A, B, UA, UX, UB, login, invitedFixture, access } from './foundation-support.mjs'

test('Fundação via PostgREST real, com sessões de usuário', async t => {
  const [a,b,multi,revoked] = await Promise.all(['a@example.com','b@example.com','multi@example.com','revogado@example.com'].map(login))
  await t.test('Cadastro público desabilitado; entrada somente por convite', async () => {
    const result=await client().auth.signUp({email:'cadastro-bloqueado@example.com',password:'Demo@123456'})
    assert.ok(result.error)
    assert.equal(result.error.code,'signup_disabled')
  })
  await t.test('SELECT A/B e usuário multiempresa isolados por RLS', async () => {
    assert.deepEqual((await a.from('tenants').select('id')).data, [{ id: A }])
    assert.deepEqual((await b.from('tenants').select('id')).data, [{ id: B }])
    assert.equal((await multi.from('tenants').select('id')).data.length, 2)
    assert.deepEqual((await revoked.from('tenants').select('*')).data, [])
    assert.equal((await a.from('units').select('*')).data.length,1)
    assert.deepEqual((await a.from('units').select('*').eq('id',UX)).data,[])
    assert.equal(await access(a,A,UB),false)
  })
  await t.test('INSERT, UPDATE, DELETE diretos e escalada são bloqueados', async () => {
    for (const c of [a,b,revoked]) {
      assert.equal((await c.from('tenants').insert({slug:'intruso',name:'Intruso'})).error?.code,'42501')
      assert.equal((await c.from('tenant_memberships').update({role:'clinic_admin'}).eq('tenant_id',A)).error?.code,'42501')
      assert.equal((await c.from('tenant_memberships').delete().eq('tenant_id',A)).error?.code,'42501')
      assert.equal((await c.from('tenants').update({status:'suspended'}).eq('id',A)).error?.code,'42501')
    }
    assert.deepEqual((await b.from('units').update({name:'Ataque'}).eq('id',UA).select()).data,[])
    assert.deepEqual((await revoked.from('units').update({name:'Ataque'}).eq('id',UA).select()).data,[])
    const own = await a.from('units').update({name:'Aurora • Centro'}).eq('id',UA).select()
    assert.equal(own.error,null); assert.equal(own.data.length,1)
    assert.equal((await a.from('units').update({tenant_id:B}).eq('id',UA)).error?.code,'42501')
  })
  await t.test('RPC valida tenant, unidade, papel, módulo e revogação', async () => {
    for (const [c,tenant,unit] of [[a,B,UB],[a,A,UX],[b,A,UA],[multi,A,UA],[revoked,A,UA]]) {
      assert.equal((await c.rpc('invite_member',{tenant,unit,email:'ataque@example.com',clinic_role:'clinic_admin'})).error?.code,'42501')
    }
    assert.equal(await access(a,A,UA,'unit.read','agenda'),false)
    assert.equal((await a.rpc('platform_tenants')).error?.code,'42501')
    assert.equal((await client().rpc('check_access',{tenant:A,unit:UA,permission:'unit.read'})).error?.code,'42501')
  })
  const fixture = await invitedFixture(t,a)
  let mid
  await t.test('Auth por convite real: identidade confirmada aceita convite transacional', async () => {
    assert.equal((await b.rpc('accept_invitation',{invitation:fixture.id})).error?.code,'42501')
    assert.equal(await access(fixture.invited,A,UA),false)
    const accepted = await fixture.invited.rpc('accept_invitation',{invitation:fixture.id})
    assert.equal(accepted.error,null); mid=accepted.data
    assert.equal(await access(fixture.invited,A,UA),true)
    assert.equal(await access(fixture.invited,B,UB),false)
    assert.equal(await access(fixture.invited,A,UX),false)
    assert.equal((await fixture.invited.rpc('accept_invitation',{invitation:fixture.id})).data,mid)
  })
  await t.test('Revogação bloqueia novas operações com o mesmo JWT e preserva B', async () => {
    const jwt = (await fixture.invited.auth.getSession()).data.session.access_token
    assert.equal((await b.rpc('revoke_membership',{tenant:A,membership:mid})).error?.code,'42501')
    assert.equal((await a.rpc('revoke_membership',{tenant:A,membership:mid})).error,null)
    assert.equal((await fixture.invited.auth.getSession()).data.session.access_token,jwt)
    assert.equal(await access(fixture.invited,A,UA,'storage.write'),false)
    assert.deepEqual((await fixture.invited.from('tenants').select('*')).data,[])
    assert.deepEqual((await fixture.invited.from('units').update({name:'Ataque'}).eq('id',UA).select()).data,[])
    assert.equal((await fixture.invited.rpc('invite_member',{tenant:A,unit:UA,email:'ataque@example.com',clinic_role:'manager'})).error?.code,'42501')
    // Repetir aceite antigo não pode reativar vínculo.
    assert.equal((await fixture.invited.rpc('accept_invitation',{invitation:fixture.id})).error?.code,'42501')
    assert.equal(await access(fixture.invited,A,UA),false)
    assert.equal(await access(b,B,UB),true)
    const events = await a.from('audit_logs').select('*').eq('entity_id',mid).eq('action','UPDATE')
    assert.equal(events.error,null); assert.ok(events.data.length)
  })
  await t.test('Convite revogado não cria vínculo', async () => {
    const f = await invitedFixture(t,a)
    assert.equal((await a.rpc('revoke_invitation',{tenant:A,invitation:f.id})).error,null)
    assert.equal((await f.invited.rpc('accept_invitation',{invitation:f.id})).error?.code,'42501')
  })
  await t.test('Convite não muda vínculo existente e e-mails inválidos são recusados', async () => {
    for (const email of ['a@example.com','revogado@example.com','@','a @ b','a@b']) {
      assert.equal((await a.rpc('invite_member',{tenant:A,unit:UA,email,clinic_role:'manager'})).error?.code,'42501')
    }
    // Dois convites emitidos antes de existir vínculo: o segundo não deve vazar 23505.
    const f=await invitedFixture(t,a)
    const other=await a.rpc('invite_member',{tenant:A,unit:UA,email:f.email,clinic_role:'reception'})
    assert.equal(other.error,null)
    assert.equal((await f.invited.rpc('accept_invitation',{invitation:f.id})).error,null)
    assert.equal((await f.invited.rpc('accept_invitation',{invitation:other.data})).error?.code,'42501')
    assert.equal((await a.rpc('revoke_membership',{tenant:A,membership:(await f.invited.from('tenant_memberships').select('id').eq('tenant_id',A).single()).data.id})).error,null)
    assert.equal((await f.invited.rpc('accept_invitation',{invitation:other.data})).error?.code,'42501')
  })
  await t.test('Storage HTTP local indisponível é identificado, sem alegar download aprovado', async () => {
    const c = localConfig()
    const jwt = (await a.auth.getSession()).data.session.access_token
    const response = await fetch(`${c.url}/storage/v1/object/authenticated/foundation-test/${A}/${UA}/a.txt`, {headers:{apikey:c.anon,Authorization:`Bearer ${jwt}`}})
    assert.equal(response.status,404) // proxy local não possui rota Storage; RLS é testada via SQL.
  })
})
