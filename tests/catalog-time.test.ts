import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addLocalMinutes } from '../src/catalog-time.ts'

test('duração local inválida não produz data', () => {
  assert.equal(addLocalMinutes('', 30, 'America/Sao_Paulo'), null)
  assert.equal(addLocalMinutes('2026-11-16', 30, 'America/Sao_Paulo'), null)
  assert.equal(addLocalMinutes('2026-11-16T09', 30, 'America/Sao_Paulo'), null)
  assert.equal(addLocalMinutes('2026-11-16T09:00', Number.NaN, 'America/Sao_Paulo'), null)
  assert.equal(addLocalMinutes('2026-11-16T09:00', 30, 'Fuso/Inexistente'), null)
})

test('soma minutos no fuso da unidade, inclusive no salto de horário de verão', () => {
  assert.equal(
    addLocalMinutes('2026-11-16T09:30', 30, 'America/Sao_Paulo'),
    '2026-11-16T10:00',
  )
  // Em 2026-03-08 o relógio de Nova York salta de 02:00 para 03:00.
  assert.equal(
    addLocalMinutes('2026-03-08T01:30', 60, 'America/New_York'),
    '2026-03-08T03:30',
  )
  assert.equal(
    addLocalMinutes('2026-03-08T01:30', 30, 'America/New_York'),
    '2026-03-08T03:00',
  )
})
