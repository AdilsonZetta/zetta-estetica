import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicKey } from '../src/public-key.ts'

test('Chave pública aceita JWT Base64URL com hífen, underscore e sem padding', () => {
  const payload = Buffer.from(JSON.stringify({ role: 'anon', marker: '\uffff😀' })).toString('base64url')
  assert.match(payload, /-/)
  assert.match(payload, /_/)
  assert.equal(publicKey(`header.${payload}.signature`), true)
})
test('Chave privilegiada e payload malformado são recusados', () => {
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')
  assert.equal(publicKey(`header.${payload}.signature`), false)
  assert.equal(publicKey('header.%%%!.signature'), false)
  assert.equal(publicKey('invalida'), false)
  assert.equal(publicKey('sb_publishable_exemplo'), true)
})
