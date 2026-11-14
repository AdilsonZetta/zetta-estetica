import { test, expect } from '@playwright/test'
test('shell sem configuração oferece orientação e preserva design responsivo', async ({ page }) => {
  await page.goto('/zetta-estetica/')
  await expect(page.getByRole('heading', { name: 'Backend não configurado' })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', {name:'Ir para o conteúdo'})).toBeFocused()
})
