import { test, expect } from '@playwright/test'
const root = '/zetta-estetica/'
test('Agenda: grade do dia, exemplo sintético e ausência de overflow', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(root)
  await page.getByLabel('E-mail', { exact: true }).fill('a@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Demo@123456')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('link', { name: /Aurora/ }).click()
  await page.getByRole('link', { name: 'Agenda', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Grade do dia' })).toBeVisible()
  await page.getByLabel('Dia').fill('2026-11-16')
  await expect(page.getByText('Mariana · exemplo').first()).toBeVisible()
  await page.getByRole('button', { name: 'Semana', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({
    path: `docs/evidencias/prompt-07-${testInfo.project.name === 'auth-local' ? 'desktop' : 'mobile'}.png`,
    fullPage: true,
  })
  expect(errors).toEqual([])
})
