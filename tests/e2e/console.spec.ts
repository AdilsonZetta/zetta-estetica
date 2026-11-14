import { test, expect, type Page } from '@playwright/test'
// @ts-expect-error fixture local Node
import { platformFixture, provisionArgs, sql } from '../console-support.mjs'
const root = '/zetta-estetica/'
async function enter(page: Page, email: string) {
  await page.goto(root)
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('Demo@123456')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Suas clínicas' })
  ).toBeVisible()
}
test('módulos A/B: menu, rota protegida e RPC', async ({ page }) => {
  await enter(page, 'a@example.com')
  await page.getByRole('link', { name: /Aurora/ }).click()
  await page.getByRole('link', { name: 'Abrir Pacotes' }).click()
  await page.getByRole('button', { name: 'Testar RPC protegida' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Permissão de teste autorizada'
  )
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await enter(page, 'b@example.com')
  await page.getByRole('link', { name: /Horizonte/ }).click()
  await expect(page.getByRole('link', { name: 'Abrir Agenda' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir Pacotes' })).toHaveCount(0)
  await page.goto(`${root}clinicas/clinica-horizonte/modulos/packages`)
  await expect(page.getByRole('alert')).toContainText('Módulo não autorizado')
})
test('prévia temporária testa configuração e exige revisão para publicar', async ({
  page
}) => {
  await enter(page, 'a@example.com')
  await page.goto(`${root}clinicas/clinica-aurora/admin`)
  await page
    .getByRole('button', { name: 'Testar configuração de Pacotes' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Revisão antes de publicar' })
  ).toBeVisible()
  await expect(
    page.getByText('Teste temporário:', { exact: false })
  ).toContainText('configuração válida')
  // Descartar comprova que a prévia não alterou o entitlement da fixture compartilhada.
  await page.getByRole('button', { name: 'Descartar prévia' }).click()
  await page.goto(`${root}clinicas/clinica-aurora/modulos/packages`)
  await expect(
    page.getByRole('button', { name: 'Testar RPC protegida' })
  ).toBeVisible()
})
test('console Zetta: sete telas, conexão pendente, ícone manual e assinatura', async ({
  page
}) => {
  const fixture = await platformFixture()
  try {
    const created = await fixture.c.rpc(
      'provision_tenant',
      provisionArgs('onboarding-ui@example.com')
    )
    expect(created.error).toBeNull()
    fixture.tenants.push(created.data)
    await enter(page, fixture.email)
    await page
      .getByRole('link', { name: 'Administração Zetta', exact: true })
      .click()
    await expect(
      page
        .getByRole('navigation', { name: 'Console Zetta' })
        .getByRole('button')
    ).toHaveCount(7)
    for (const section of [
      'Instalações de ícone',
      'Conexões',
      'Assinaturas SaaS',
      'Suporte'
    ]) {
      await page.getByRole('button', { name: section, exact: true }).click()
      await expect(
        page.getByText(
          'Selecione uma empresa para consultar e alterar esta seção.'
        )
      ).toBeVisible()
    }
    await page.getByRole('button', { name: 'Empresas', exact: true }).click()
    await page.getByLabel('Buscar nome, plano ou estado').fill('Essencial')
    await expect(
      page.locator('.tenant-card').filter({ hasText: 'essential' }).first()
    ).toBeVisible()
    await page.getByLabel('Buscar nome, plano ou estado').fill('Ativa')
    await expect(page.locator('.tenant-card').first()).toBeVisible()
    await page.getByLabel('Empresa em revisão').focus()
    await page.getByLabel('Empresa em revisão').selectOption(created.data)
    await expect(page.getByLabel('Empresa em revisão')).toBeFocused()
    const card = page
      .getByRole('button', { name: /Clínica sintética console/ })
      .last()
    await card.click()
    await expect(card).toBeFocused()
    await expect(page.getByLabel('Marca', { exact: true })).toHaveValue(
      'Marca sintética'
    )
    await page.getByRole('button', { name: 'Conexões', exact: true }).click()
    await expect(
      page.getByText('Pendente — implantar em modo manual')
    ).toBeVisible()
    // Transporte Edge controlado; persiste o efeito que precede o HTTP 502 no handler.
    await page.route('**/functions/v1/invitation-delivery', async (route) => {
      sql(
        `update private.invitation_delivery set state='failed',attempts=attempts+1,last_code='AUTH_DELIVERY_FAILED' where tenant_id='${created.data}'`
      )
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: '{"code":"AUTH_DELIVERY_FAILED"}'
      })
    })
    await page
      .getByRole('button', { name: 'Enviar / tentar novamente' })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Pedido salvo. Envio indisponível'
    )
    await expect(page.getByText(/Envio: failed.*tentativas: 1/)).toBeVisible()
    await page
      .getByRole('button', { name: 'Testar conexão', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('Teste bloqueado')
    await page
      .getByRole('button', { name: 'Instalações de ícone', exact: true })
      .click()
    await expect(page.getByLabel('URL para instalação manual')).toHaveValue(
      /\/clinicas\/teste-/
    )
    await page
      .getByLabel('Referência manual da conta (sem credenciais)')
      .fill('Conta FLW sintética')
    await page
      .getByRole('button', { name: 'Registrar configuração manual' })
      .click()
    await expect(page.getByRole('status')).toContainText('Alteração registrada')
    await page
      .getByRole('button', { name: 'Assinaturas SaaS', exact: true })
      .click()
    await expect(page.getByLabel('Plano contratado')).toHaveValue('essential')
    await page
      .getByRole('button', { name: 'Catálogo de módulos', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Catálogo versionado' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Onboarding', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Provisionar empresa' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Suporte', exact: true }).click()
    await page
      .getByRole('button', {
        name: 'Consultar diagnóstico com minha concessão'
      })
      .click()
    await expect(page.getByRole('status')).toContainText(
      'Concessão temporária necessária'
    )
    expect(
      await page
        .locator('body')
        .evaluate((el) => el.scrollWidth <= window.innerWidth)
    ).toBe(true)
  } finally {
    await fixture.cleanup()
  }
})

test('clínica sem unidade apresenta vazio sem enviar UUID inválido', async ({
  page
}) => {
  await enter(page, 'a@example.com')
  const invalid: string[] = []
  page.on('request', (request) => {
    if (
      request.url().includes('/rpc/check_access') &&
      request.postDataJSON()?.unit === ''
    )
      invalid.push(request.url())
  })
  // Simula perda da unidade entre as consultas autorizadas de tenant e unidades.
  await page.route('**/rest/v1/units?*', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' })
  )
  await page.goto(`${root}clinicas/clinica-aurora`)
  await expect(page.getByText('Nenhuma unidade autorizada.')).toBeVisible()
  await expect(
    page.getByText('Módulos da clínica', { exact: true })
  ).toHaveCount(0)
  expect(invalid).toEqual([])
})
