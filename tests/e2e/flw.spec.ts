import { test, expect } from '@playwright/test'
// @ts-expect-error suporte local Node
import { sql } from '../console-support.mjs'
const root = '/zetta-estetica/'
test('FLW pendente cria tarefa manual, vincula referência e preserva bloqueio', async ({
  page
}) => {
  const marker = `ui_${Date.now()}`
  const integration = page
    .getByRole('heading', { name: 'Integração FLW · modo manual' })
    .locator('..')
  let event: string | undefined
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  try {
    await page.route(
      '**/rpc/flw_operations',
      (route) => route.abort('failed'),
      { times: 1 }
    )
    await page.goto(root)
    await page.getByLabel('E-mail', { exact: true }).fill('a@example.com')
    await page.getByLabel('Senha', { exact: true }).fill('Demo@123456')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.getByRole('link', { name: /Aurora/ }).click()
    await page.getByRole('link', { name: 'Administrar equipe' }).click()
    await expect(
      page.getByRole('heading', { name: 'Integração FLW · modo manual' })
    ).toBeVisible()
    await expect(integration.getByRole('status')).toContainText(
      'Não foi possível consultar as operações.'
    )
    await expect(page.getByText('Carregando operações…')).toHaveCount(0)
    await page.getByLabel('Operação manual').selectOption('charge.create')
    await page.route(
      '**/rpc/request_flw_operation',
      (route) => route.abort('failed'),
      { times: 1 }
    )
    await page.getByRole('button', { name: 'Registrar tarefa manual' }).click()
    await expect(integration.getByRole('status')).toContainText(
      'Não foi possível registrar.'
    )
    await expect(
      page.getByRole('button', { name: 'Registrar tarefa manual' })
    ).toBeEnabled()
    const response = page.waitForResponse((r) =>
      r.url().includes('/rpc/request_flw_operation')
    )
    await page.getByRole('button', { name: 'Registrar tarefa manual' }).click()
    const body = await (await response).json()
    event = body.event_id
    expect(body.code).toBe('CAPABILITY_NOT_VERIFIED')
    const task = page
      .getByRole('listitem')
      .filter({ hasText: body.correlation_id })
    await task
      .getByLabel('Referência externa (somente ID, sem conteúdo privado)')
      .fill(marker)
    await page.route(
      '**/rpc/complete_flw_manual_task',
      (route) => route.abort('failed'),
      { times: 1 }
    )
    await task
      .getByRole('button', { name: 'Concluir tarefa com vínculo' })
      .click()
    await expect(integration.getByRole('status')).toContainText(
      'Use uma referência opaca válida e confira seu acesso.'
    )
    await expect(
      task.getByRole('button', { name: 'Concluir tarefa com vínculo' })
    ).toBeEnabled()
    await task
      .getByRole('button', { name: 'Concluir tarefa com vínculo' })
      .click()
    await expect(task).toContainText('Concluída manualmente')
    await expect(task).toContainText(marker)
    await expect(task).toContainText('CAPABILITY_NOT_VERIFIED')
    await page.reload()
    await expect(
      page.getByRole('listitem').filter({ hasText: marker })
    ).toContainText('Concluída manualmente')
    expect(pageErrors).toEqual([])
  } finally {
    if (event)
      sql(
        `delete from private.integration_manual_tasks where event_id='${event}'; delete from private.integration_deliveries where event_id='${event}'; delete from private.outbox_events where id='${event}'`
      )
  }
})
