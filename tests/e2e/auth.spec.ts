import { test, expect } from '@playwright/test'
// @ts-expect-error módulo de suporte Node, não empacotado pelo Vite
import { client, createDemoUsers, expiredSession } from '../local-auth.mjs'

test('login A e B, reload, saída e retorno aprovado com Auth real', async ({ page }) => {
  const fixture = await createDemoUsers()
  try {
    for (const [index, user] of fixture.users.entries()) {
      await page.goto(`/zetta-estetica/integration-lab?clinic=${index ? 'clinica-horizonte' : 'clinica-aurora'}`)
      await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
      await page.getByLabel('E-mail de teste').fill(user.email)
      await page.getByLabel('Senha de teste').fill(user.password)
      await page.getByRole('button', { name: 'Entrar no laboratório' }).click()
      await expect(page.getByText('Identidade autenticada', { exact: false })).toBeVisible()
      await page.reload()
      await expect(page.getByText('Identidade autenticada', { exact: false })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Voltar à FLW' })).toHaveAttribute('href', 'https://flw.example.invalid/conta')
      await page.getByRole('button', { name: 'Sair do laboratório' }).click()
      await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
      await page.reload()
      await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
    }
  } finally { await fixture.cleanup() }
})
test('falha de login preserva estado e limpa a senha', async ({ page }) => {
  await page.goto('/zetta-estetica/integration-lab')
  await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
  await page.getByLabel('E-mail de teste').fill('inexistente@example.com')
  await page.getByLabel('Senha de teste').fill('invalida')
  await page.getByRole('button', { name: 'Entrar no laboratório' }).click()
  await expect(page.getByText('Não foi possível entrar.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Senha de teste')).toHaveValue('')
})

test('sessão com JWT expirado é renovada pelo Auth ao reabrir a prova', async ({ page }) => {
  const fixture = await createDemoUsers()
  try {
    const api = client()
    const { data, error } = await api.auth.signInWithPassword(fixture.users[0])
    expect(error).toBeNull()
    const expired = expiredSession(data.session)
    await page.goto('/zetta-estetica/integration-lab')
    await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
    await page.evaluate(value => localStorage.setItem('zetta-discovery-auth', JSON.stringify(value)), expired)
    const refresh = page.waitForResponse(response => response.url().includes('/auth/v1/token?grant_type=refresh_token') && response.status() === 200)
    await page.reload()
    await refresh
    await expect(page.getByText('Identidade autenticada', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Sair do laboratório' }).click()
    await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
  } finally { await fixture.cleanup() }
})

test('falha remota no logout ainda encerra a sessão persistida local', async ({ page }) => {
  const fixture = await createDemoUsers()
  try {
    await page.goto('/zetta-estetica/integration-lab')
    await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
    await page.getByLabel('E-mail de teste').fill(fixture.users[0].email)
    await page.getByLabel('Senha de teste').fill(fixture.users[0].password)
    await page.getByRole('button', { name: 'Entrar no laboratório' }).click()
    await expect(page.getByText('Identidade autenticada', { exact: false })).toBeVisible()
    await page.route('**/auth/v1/logout*', route => route.fulfill({ status: 400, json: { msg: 'Falha remota simulada' } }))
    await page.getByRole('button', { name: 'Sair do laboratório' }).click()
    await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
    await expect(page.getByText('Revogação remota não confirmada.', { exact: false })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('zetta-discovery-auth'))).toBeNull()
    await page.reload()
    await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
  } finally { await fixture.cleanup() }
})

test('sessão persistida exige identidade aceita pelo servidor antes de liberar o formulário', async ({ page }) => {
  const fixture = await createDemoUsers()
  try {
    const api = client()
    const { data, error } = await api.auth.signInWithPassword(fixture.users[0])
    expect(error).toBeNull()
    await page.goto('/zetta-estetica/integration-lab')
    await expect(page.getByText('Sem sessão ativa', { exact: true })).toBeVisible()
    await page.evaluate(value => localStorage.setItem('zetta-discovery-auth', JSON.stringify(value)), data.session)
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const requested = new Promise<void>(resolve => {
      void page.route('**/auth/v1/user', async route => {
        resolve()
        await gate
        await route.fulfill({ status: 401, json: { msg: 'Identidade rejeitada' } })
      })
    })
    await page.reload()
    await requested
    await expect(page.getByText('Verificando sessão…', { exact: true })).toBeVisible()
    const url = page.url()
    await page.locator('#login').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(page.url()).toBe(url)
    release()
    await expect(page.getByText('Não foi possível verificar a sessão.', { exact: false })).toBeVisible()
    await expect(page.getByText('Identidade autenticada', { exact: false })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Entrar no laboratório' })).toBeEnabled()
  } finally { await fixture.cleanup() }
})
