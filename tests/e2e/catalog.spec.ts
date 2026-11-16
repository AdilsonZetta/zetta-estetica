import { test, expect } from '@playwright/test'
// @ts-expect-error suporte SQL local
import { sql } from '../console-support.mjs'
// @ts-expect-error Auth Node exclusivamente local
import { login, A, UA } from '../foundation-support.mjs'
const root = '/zetta-estetica/'
async function enter(page: import('@playwright/test').Page) {
  await page.goto(root)
  await page.getByLabel('E-mail', { exact: true }).fill('a@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('Demo@123456')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.getByRole('link', { name: /Aurora/ }).click()
  await page.getByRole('link', { name: 'Catálogo', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Serviços, profissionais e recursos' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Voltar à clínica', exact: true }),
  ).toBeVisible()
}
test('Catálogo: publicar, versionar, inativar e ler histórico', async ({
  page,
}, testInfo) => {
  const marker = `ui_catalog_${Date.now()}`
  let id: string | undefined
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await enter(page)
    await page.getByLabel('Buffer depois (min)').fill('10')
    await page.getByLabel('Nome do serviço', { exact: true }).fill(marker)
    await page
      .getByLabel('Preparo administrativo')
      .fill('Confirmar cadastro sintético.')
    await expect(page.locator('.catalog-preview')).toContainText(
      '45 min de ocupação',
    )
    await page.screenshot({
      path: `docs/evidencias/prompt-06-${testInfo.project.name === 'auth-local' ? 'desktop' : 'mobile'}.png`,
      fullPage: true,
    })
    const created = page.waitForResponse((r) =>
      r.url().includes('/rpc/publish_catalog_service'),
    )
    await page
      .getByRole('button', { name: 'Publicar versão', exact: true })
      .click()
    const vid = await (await created).json()
    id = sql(
      `select service_id from private.catalog_service_versions where id='${vid}'`,
    )
    await expect(
      page.getByRole('status').filter({ hasText: 'Versão publicada' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: `Ver serviço ${marker}`, exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: `Nova versão de ${marker}` }),
    ).toBeVisible()
    await page.getByLabel('Preço em centavos').fill('18000')
    await page.getByLabel('Duração em minutos').fill('45')
    await page.getByLabel('Estado do serviço').selectOption('inactive')
    await expect(page.locator('.catalog-preview')).toContainText(
      '60 min de ocupação',
    )
    await page
      .getByRole('button', { name: 'Publicar versão', exact: true })
      .click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Versão publicada' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: `Ver serviço ${marker}`, exact: true })
      .click()
    await expect(page.locator('aside')).toContainText('v1 · Publicado')
    await expect(page.locator('aside')).toContainText('v2 · Inativo')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    expect(errors).toEqual([])
  } finally {
    if (id)
      sql(
        `delete from private.catalog_service_resources where version_id in (select id from private.catalog_service_versions where service_id='${id}');delete from private.catalog_requirements where version_id in (select id from private.catalog_service_versions where service_id='${id}');delete from private.catalog_service_units where version_id in (select id from private.catalog_service_versions where service_id='${id}');delete from private.catalog_service_versions where service_id='${id}';delete from private.catalog_services where id='${id}'`,
      )
  }
})
test('Catálogo: recurso, jornada, folga, conflito e disponibilidade', async ({
  page,
}) => {
  const marker = `ui_recurso_${Date.now()}`
  let id: string | undefined
  let serviceId: string | undefined
  try {
    await enter(page)
    await page
      .getByRole('button', { name: 'Profissionais e recursos', exact: true })
      .click()
    await page.getByLabel('Nome do recurso', { exact: true }).fill(marker)
    await page
      .getByLabel('Qualificação operacional')
      .fill('Qualificação sintética')
    const created = page.waitForResponse((r) =>
      r.url().includes('/rpc/save_catalog_resource'),
    )
    await page
      .getByRole('button', { name: 'Salvar recurso', exact: true })
      .click()
    id = await (await created).json()
    await expect(
      page.getByRole('status').filter({ hasText: 'Recurso salvo' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Jornadas e disponibilidade', exact: true })
      .click()
    await page.getByLabel('Recurso da jornada').selectOption(id!)
    await page.getByLabel('Início local').fill('2026-11-18T09:00')
    await page.getByLabel('Fim local').fill('2026-11-18T12:00')
    await page
      .getByRole('button', { name: 'Salvar jornada', exact: true })
      .click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Jornada salva' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Salvar jornada', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText('Conflito de jornada')
    await page
      .getByRole('button', { name: 'Consultar disponibilidade', exact: true })
      .click()
    await expect(
      page.getByText(`Profissional · ${marker} · Livre na configuração`, {
        exact: false,
      }),
    ).toBeVisible()
    await page.getByLabel('Tipo da janela').selectOption('off')
    await page
      .getByRole('button', { name: 'Salvar jornada', exact: true })
      .click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Jornada salva' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Consultar disponibilidade', exact: true })
      .click()
    await expect(
      page.getByText(`Profissional · ${marker} · Sem janela livre`, {
        exact: false,
      }),
    ).toBeVisible()
    // Uma habilitação histórica desativada continua removível na próxima versão.
    const a = await login('a@example.com')
    const createdService = await a.rpc('publish_catalog_service', {
      tenant: A,
      unit: UA,
      payload: servicePayload(`${marker}_servico`, {
        resources: [{ resource_id: id, unit_id: UA }],
        requirements: [],
      }),
    })
    expect(createdService.error).toBeNull()
    serviceId = sql(
      `select service_id from private.catalog_service_versions where id='${createdService.data}'`,
    )
    const inactive = await a.rpc('save_catalog_resource', {
      tenant: A,
      unit: UA,
      resource: id,
      expected_version: 1,
      payload: resourcePayload(marker, [UA], { active: false }),
    })
    expect(inactive.error).toBeNull()
    await page.getByRole('button', { name: 'Serviços', exact: true }).click()
    await page
      .getByRole('button', {
        name: `Ver serviço ${marker}_servico`,
        exact: true,
      })
      .click()
    const historical = page.getByRole('checkbox', {
      name: new RegExp(`Profissional · ${marker} · Habilitação indisponível`),
    })
    await expect(historical).toBeChecked()
    await historical.uncheck()
    await page
      .getByRole('button', { name: 'Publicar versão', exact: true })
      .click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Versão publicada' }),
    ).toBeVisible()
    expect(
      sql(
        `select count(*) from private.catalog_service_resources where version_id='${createdService.data}'`,
      ),
    ).toBe('1')
    expect(
      sql(
        `select count(*) from private.catalog_service_resources sr join private.catalog_service_versions v on v.id=sr.version_id where v.service_id='${serviceId}' and v.version=2`,
      ),
    ).toBe('0')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  } finally {
    if (serviceId)
      sql(
        `delete from private.catalog_service_resources where version_id in (select id from private.catalog_service_versions where service_id='${serviceId}');delete from private.catalog_requirements where version_id in (select id from private.catalog_service_versions where service_id='${serviceId}');delete from private.catalog_service_units where version_id in (select id from private.catalog_service_versions where service_id='${serviceId}');delete from private.catalog_service_versions where service_id='${serviceId}';delete from private.catalog_services where id='${serviceId}'`,
      )
    if (id)
      sql(
        `delete from private.catalog_windows where resource_id='${id}';delete from private.catalog_resource_units where resource_id='${id}';delete from private.catalog_resources where id='${id}'`,
      )
  }
})

// @ts-expect-error fixtures Node com Auth real, fora do bundle
import { catalogFixture, resourcePayload, servicePayload } from '../catalog-support.mjs'
test('Catálogo: fuso persistido acompanha a troca entre unidades', async ({
  page,
}) => {
  const cleanups: (() => Promise<void>)[] = []
  const f = await catalogFixture({
    after: (cleanup: () => Promise<void>) => cleanups.push(cleanup),
  })
  const { data } = await f.c.auth.getUser()
  const tenant = '10000000-0000-0000-0000-000000000001'
  const center = '10000000-0000-0000-0000-000000000011'
  const second = '10000000-0000-0000-0000-000000000012'
  const original = sql(`select timezone from public.units where id='${second}'`)
  try {
    await page.goto(root)
    await page.getByLabel('E-mail', { exact: true }).fill(data.user.email)
    await page.getByLabel('Senha', { exact: true }).fill('Demo@123456')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.getByRole('link', { name: /Aurora/ }).click()
    await page.getByRole('link', { name: 'Catálogo', exact: true }).click()
    await page.getByLabel('Unidade ativa').selectOption(second)
    await page
      .getByRole('button', { name: 'Jornadas e disponibilidade', exact: true })
      .click()
    await page.getByLabel('Fuso IANA da unidade').fill('America/Manaus')
    await page.getByRole('button', { name: 'Salvar fuso', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Fuso atualizado' }),
    ).toBeVisible()
    await page.getByLabel('Unidade ativa').selectOption(center)
    await page
      .getByRole('button', { name: 'Jornadas e disponibilidade', exact: true })
      .click()
    await expect(page.getByLabel('Fuso IANA da unidade')).toHaveValue(
      'America/Sao_Paulo',
    )
    await page.getByLabel('Unidade ativa').selectOption(second)
    await page
      .getByRole('button', { name: 'Jornadas e disponibilidade', exact: true })
      .click()
    await expect(page.getByLabel('Fuso IANA da unidade')).toHaveValue(
      'America/Manaus',
    )
  } finally {
    const restored = await f.c.rpc('set_catalog_timezone', {
      tenant,
      unit: second,
      timezone: original,
    })
    expect(restored.error).toBeNull()
    for (const cleanup of cleanups) await cleanup()
  }
})
