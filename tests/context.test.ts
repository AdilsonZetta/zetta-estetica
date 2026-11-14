import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearTenantContext,
  trackPreview,
  registerContextCleanup
} from '../src/context.ts'
test('troca e logout cancelam recursos e revogam previews privados', async () => {
  const preview = trackPreview(
    URL.createObjectURL(new Blob(['documento sintético']))
  )
  assert.equal(await (await fetch(preview)).text(), 'documento sintético')
  const controller = new AbortController()
  let unsubscribed = false
  registerContextCleanup(() => {
    controller.abort()
    unsubscribed = true
  })
  clearTenantContext()
  assert.equal(controller.signal.aborted, true)
  assert.equal(unsubscribed, true)
  await assert.rejects(fetch(preview))
  clearTenantContext()
})

test('callback com falha não impede os demais descartes nem a revogação de Blob', async () => {
  const preview = trackPreview(URL.createObjectURL(new Blob(['privado'])))
  let calls = 0
  registerContextCleanup(() => { throw new Error('falha sintética') })
  registerContextCleanup(() => { calls++ })
  assert.doesNotThrow(clearTenantContext)
  assert.equal(calls, 1)
  await assert.rejects(fetch(preview))
  clearTenantContext()
  assert.equal(calls, 1)
})
