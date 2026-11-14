import { test, expect } from '@playwright/test'

const path = '/zetta-estetica/integration-lab'
test('sem backend mostra estado claro e formulário desabilitado', async ({ page }) => {
  const response = await page.goto(path)
  expect(response?.status()).toBe(200)
  await expect(page.getByText('Backend não configurado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar no laboratório' })).toBeDisabled()
  await expect(page.getByLabel('E-mail de teste')).toBeVisible()
})
test('alterna os destinos sintéticos sem prometer autorização', async ({ page }) => {
  const response = await page.goto(path)
  expect(response?.status()).toBe(200)
  await expect(page.getByText('SIM-CARD-A')).toBeVisible()
  await page.getByLabel('Clínica de demonstração').selectOption('clinica-horizonte')
  await expect(page.getByText('SIM-CARD-B')).toBeVisible()
  await expect(page.getByText('SIM-CARD-A')).toHaveCount(0)
  const reload = await page.reload()
  expect(reload?.status()).toBe(200)
  await expect(page.getByText('SIM-CARD-B')).toBeVisible()
})
test('destino desconhecido não escolhe outra clínica silenciosamente', async ({ page }) => {
  await page.goto(`${path}?clinic=outra`)
  await expect(page.getByText('Destino desconhecido.', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir prova em nova aba' })).toBeHidden()
})
test('capacidade é simulação sem requisição para a FLW', async ({ page }) => {
  const requests: string[] = []
  page.on('request', req => { if (req.url().includes('flw.chat')) requests.push(req.url()) })
  await page.goto(path)
  await page.getByRole('button', { name: 'Verificar estado da operação' }).click()
  await expect(page.getByText('CAPABILITY_NOT_VERIFIED', { exact: false })).toBeVisible()
  expect(requests).toEqual([])
})
test('nova aba leva à prova com destino B (lançador local, não FLW)', async ({ page, context }) => {
  await page.goto(`${path}?clinic=clinica-horizonte`)
  const promise = context.waitForEvent('page')
  await page.getByRole('link', { name: 'Abrir prova em nova aba' }).click()
  const other = await promise
  await expect(other.getByText('SIM-CARD-B')).toBeVisible()
  expect(await other.evaluate(() => window.opener === null)).toBe(true)
})
test('retorno não configurado e parâmetros não autorizados são ignorados', async ({ page }) => {
  await page.goto(`${path}?clinic=clinica-aurora&return_url=https://evil.invalid&token=falso#access_token=falso`)
  await expect(page.getByText('Retorno à FLW não configurado.', { exact: false })).toBeVisible()
  expect(page.url()).not.toContain('falso')
  expect(page.url()).not.toContain('evil')
  await expect(page.getByRole('link', { name: 'Voltar à FLW' })).toHaveCount(0)
})
test('layout sem overflow e movimento reduzido respeitado', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(path)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.locator('.glass').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toBeFocused()
})
