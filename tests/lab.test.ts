import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approvedReturnUrl, capabilityResult, isPublicKey, proofUrl, resolveClinic } from '../integration-lab/lab.ts'
import { clinics } from '../fixtures/simulacao/clinics.ts'

test('fixtures de duas clínicas são explicitamente sintéticas', () => {
  assert.equal(clinics.length, 2)
  assert.ok(clinics.every(c => c.simulated))
  assert.notEqual(clinics[0].card, clinics[1].card)
})
test('destino escolhe somente fixtures conhecidas', () => {
  assert.equal(resolveClinic('')?.slug, 'clinica-aurora')
  assert.equal(resolveClinic('?clinic=clinica-horizonte')?.card, 'SIM-CARD-B')
  assert.equal(resolveClinic('?clinic=outra'), null)
})
test('parâmetros de SSO e retorno não influenciam o destino', () => {
  assert.equal(resolveClinic('?tenant_id=outro&token=falso&return_url=https://evil.invalid')?.slug, 'clinica-aurora')
})
test('retorno exige HTTPS e configuração sem credenciais, query ou fragmento', () => {
  for (const value of [undefined, '', 'javascript:alert(1)', '//evil.invalid', 'http://flw.invalid', 'https://user:pass@flw.invalid', 'https://flw.invalid/?token=x', 'https://flw.invalid/#token']) assert.equal(approvedReturnUrl(value), null)
  assert.equal(approvedReturnUrl('https://flw.example.invalid/conta'), 'https://flw.example.invalid/conta')
})
test('chave privilegiada ou inválida é rejeitada no navegador', () => {
  const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.sig`
  assert.equal(isPublicKey(jwt('anon')), true)
  for (const key of [jwt('service_role'), 'sb_secret_exemplo', '', 'invalida']) assert.equal(isPublicKey(key), false)
  assert.equal(isPublicKey('sb_publishable_exemplo'), true)
})
test('link mantém base Pages e só transporta o destino fictício', () => {
  assert.equal(proofUrl('http://localhost:5173', '/zetta-estetica/', clinics[1].slug), 'http://localhost:5173/zetta-estetica/integration-lab?clinic=clinica-horizonte')
})
test('capacidade indisponível nunca retorna sucesso da FLW', () => {
  assert.deepEqual({ code: capabilityResult().code, simulated: capabilityResult().simulated }, { code: 'CAPABILITY_NOT_VERIFIED', simulated: true })
})
