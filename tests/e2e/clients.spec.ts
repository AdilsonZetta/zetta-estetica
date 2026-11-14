import { test, expect } from '@playwright/test'
// @ts-expect-error suporte SQL local
import { sql } from '../console-support.mjs'
const root = '/zetta-estetica/'
async function enter(page: import('@playwright/test').Page) {
  await page.goto(root)
  await page.getByLabel('E-mail', { exact: true }).fill('a@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Demo@123456')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('link', { name: /Aurora/ }).click()
  await page.getByRole('link', { name: 'Clientes', exact: true }).click()
}
test('Cliente: cadastro, telefone compartilhado, CRM manual, merge e prévia', async ({
  page
}) => {
  const marker = `ui_cliente_${Date.now()}`,
    ids: string[] = []
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await enter(page)
    const region = page.getByRole('region', { name: 'Cadastro de clientes' })
    await page.getByLabel('Nome do cliente', { exact: true }).fill(marker)
    await page.getByLabel('Telefone (com DDD ou +país)').fill('(11) 99999-5656')
    const saved = page.waitForResponse((r) =>
      r.url().includes('/rpc/save_client')
    )
    await page
      .getByRole('button', { name: 'Salvar cliente', exact: true })
      .click()
    const source = await (await saved).json()
    ids.push(source)
    await expect(
      page.getByRole('heading', { name: `Ficha resumida · ${marker}` })
    ).toBeVisible()
    await expect(region).toContainText('+5511999995656')
    await expect(
      page.getByRole('button', { name: 'Abrir no CRM FLW · indisponível' })
    ).toBeDisabled()
    await page.getByLabel('Tipo de vínculo FLW').selectOption('card')
    await page.getByLabel('Identificador FLW', { exact: true }).fill(marker)
    await page
      .getByLabel('Referência do registro de origem')
      .fill('registro_ui')
    await page
      .getByRole('button', { name: 'Registrar vínculo manual', exact: true })
      .click()
    await expect(region).toContainText('Pendente de revisão')
    await page
      .getByRole('button', { name: `Confirmar vínculo ${marker}` })
      .click()
    await expect(region).toContainText('Confirmado manualmente')
    await page
      .getByRole('button', { name: 'Novo cliente', exact: true })
      .click()
    await page.getByLabel('Nome do cliente', { exact: true }).fill(marker)
    await page.getByLabel('Telefone (com DDD ou +país)').fill('(11) 99999-5656')
    await page
      .getByRole('button', { name: 'Salvar cliente', exact: true })
      .click()
    await expect(region.getByRole('alert')).toContainText('Operação recusada')
    await page.getByLabel(/Revisei os homônimos/).check()
    const next = page.waitForResponse((r) =>
      r.url().includes('/rpc/save_client')
    )
    await page
      .getByRole('button', { name: 'Salvar cliente', exact: true })
      .click()
    const dest = await (await next).json()
    ids.push(dest)
    await expect(
      page.getByRole('heading', { name: `Ficha resumida · ${marker}` })
    ).toBeVisible()
    await page.getByLabel('Pesquisar por nome ou telefone').fill(marker)
    await page
      .getByRole('button', { name: 'Pesquisar clientes', exact: true })
      .click()
    await expect(region.locator('.client-list li')).toHaveCount(2)
    await region
      .locator('.client-list li')
      .filter({ hasText: source })
      .getByRole('button')
      .click()
    await expect(region).toContainText(`UUID: ${source}`)
    await page.getByText('Merge supervisionado', { exact: true }).click()
    await page
      .getByLabel('UUID do sobrevivente')
      .fill(`  ${source.toUpperCase()}  `)
    await page
      .getByRole('button', { name: 'Preparar revisão do merge' })
      .click()
    await expect(region.getByRole('alert')).toContainText(
      'Escolha outro cliente'
    )
    await expect(page.getByLabel('Motivo do merge')).toHaveCount(0)
    await page.getByLabel('UUID do sobrevivente').fill(`  ${dest}  `)
    await page
      .getByRole('button', { name: 'Preparar revisão do merge' })
      .click()
    await page
      .getByLabel('Motivo do merge')
      .fill('Duplicidade sintética conferida')
    await page
      .getByLabel('Conferi as duas identidades e autorizo o merge.')
      .check()
    await page
      .getByRole('button', { name: 'Confirmar merge supervisionado' })
      .click()
    await expect(region).toContainText('Origem arquivada')
    await page
      .getByRole('button', { name: 'Abrir cadastro sobrevivente' })
      .click()
    await expect(region).toContainText('Confirmado manualmente')
    await page.getByText('Merge supervisionado', { exact: true }).click()
    await page.getByLabel('UUID do sobrevivente').fill(source)
    await page
      .getByRole('button', { name: 'Preparar revisão do merge' })
      .click()
    await expect(region.getByRole('alert')).toContainText(
      'O sobrevivente está arquivado'
    )
    await expect(page.getByLabel('Motivo do merge')).toHaveCount(0)
    // Novo cliente limpa o erro anterior; a próxima seleção mostra carregamento e limpa mensagens.
    await page
      .getByRole('button', { name: 'Novo cliente', exact: true })
      .click()
    await expect(region.getByRole('alert')).toHaveCount(0)
    let releaseDetail!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseDetail = resolve
    })
    await page.route(
      '**/rpc/client_detail',
      async (route) => {
        await gate
        await route.continue()
      },
      { times: 1 }
    )
    await region
      .locator('.client-list li')
      .filter({ hasText: dest })
      .getByRole('button')
      .click()
    await expect(
      region.getByText('Carregando ficha…', { exact: true })
    ).toBeVisible()
    await expect(region.getByRole('alert')).toHaveCount(0)
    releaseDetail()
    await expect(region).toContainText(`UUID: ${dest}`)
    await page.getByRole('tab', { name: 'Histórico cadastral' }).click()
    await expect(region.getByRole('tabpanel')).toContainText(
      'Cadastro mesclado e arquivado'
    )
    await page.getByText('Prévia de importação', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Gerar prévia sem importar' })
      .click()
    await expect(region).toContainText(
      '3 linhas · 1 rejeições · 2 exigem revisão'
    )
    await expect(
      page.getByRole('button', {
        name: 'Baixar relatório de rejeições e revisão'
      })
    ).toBeVisible()
    await page.reload()
    await page.getByLabel('Pesquisar por nome ou telefone').fill('999995656')
    await page
      .getByRole('button', { name: 'Pesquisar clientes', exact: true })
      .click()
    await expect(region.locator('.client-list li')).toHaveCount(2)
    expect(errors).toEqual([])
  } finally {
    if (ids.length)
      sql(
        `delete from private.client_events where client_id in ('${ids.join("','")}');delete from private.client_links where client_id in ('${ids.join("','")}');delete from private.clients where id in ('${ids.join("','")}')`
      )
  }
})
test('Cliente: falha de rede termina carregamento e permite recuperar a pesquisa', async ({
  page
}) => {
  await page.route('**/rpc/search_clients', (r) => r.abort('failed'), {
    times: 1
  })
  await enter(page)
  const region = page.getByRole('region', { name: 'Cadastro de clientes' })
  await expect(region.getByRole('alert')).toContainText(
    'Não foi possível carregar clientes'
  )
  await expect(region.getByText('Carregando clientes…')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Pesquisar clientes', exact: true })
    .click()
  await expect(region.getByRole('alert')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Pesquisar clientes', exact: true })
  ).toBeEnabled()
})
