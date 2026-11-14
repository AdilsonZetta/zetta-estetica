import { test, expect, type Page } from '@playwright/test'
// @ts-expect-error suporte exclusivamente Node
import { login, invitedFixture, A } from '../foundation-support.mjs'
// @ts-expect-error suporte exclusivamente Node
import { client, localConfig, expiredSession } from '../local-auth.mjs'
const root = '/zetta-estetica/'
async function enter(page: Page, email: string) {
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('Demo@123456')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}
test('launch específico preserva destino no login, recarrega e nega troca de slug', async ({
  page
}) => {
  await page.goto(`${root}launch/clinica-aurora?return=https://evil.invalid`)
  await enter(page, 'a@example.com')
  await expect(page).toHaveURL(/\/clinicas\/clinica-aurora$/)
  await expect(page.getByRole('heading', { name: /Aurora/ })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Unidade ativa')).toBeVisible()
  await page.goto(`${root}launch/clinica-horizonte`)
  await expect(
    page.getByRole('heading', { name: 'Acesso indisponível' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Voltar à FLW' })
  ).toHaveAttribute('href', 'https://flw.example.invalid/conta')
  await expect(page.getByText('Aurora', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await enter(page, 'b@example.com')
  await expect(page).toHaveURL(/\/clinicas\/clinica-horizonte$/)
})
test('launch genérico seleciona dois vínculos reais e limpa contexto na troca', async ({
  page
}) => {
  await page.goto(`${root}launch`)
  await enter(page, 'multi@example.com')
  await expect(
    page.getByRole('heading', { name: 'Suas clínicas' })
  ).toBeVisible()
  await page.getByRole('link', { name: /Aurora/ }).click()
  await expect(page.getByRole('heading', { name: /Aurora/ })).toBeVisible()
  await page.getByRole('link', { name: 'Abrir Pacotes' }).click()
  await page.getByRole('button', { name: 'Testar RPC protegida' }).click()
  await expect(page.getByRole('status')).toContainText('autorizada')
  await page.goto(`${root}launch/clinica-horizonte`)
  await expect(page.getByRole('heading', { name: /Horizonte/ })).toBeVisible()
  await expect(
    page.getByText('Permissão de teste autorizada.', { exact: false })
  ).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Abrir Pacotes' })).toHaveCount(0)
})
test('código real de convite e revogação observada ao retornar à aba', async ({
  page
}) => {
  const callbacks: (() => Promise<void>)[] = []
  const a = await login('a@example.com')
  const f = await invitedFixture(
    { after: (fn: () => Promise<void>) => callbacks.push(fn) },
    a
  )
  try {
    const admin = client(localConfig().service)
    const code = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: f.email
    })
    expect(code.error).toBeNull()
    await page.goto(`${root}convites/${f.id}`)
    await expect(page.getByRole('link', { name: 'Escolher outra clínica' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Acessar conta existente por código', exact: true }).click()
    await page.getByRole('button', { name: 'Usar senha existente', exact: true }).click()
    await page.getByRole('button', { name: 'Usar código do convite', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Usar código do convite', exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Código do e-mail')).toBeVisible()
    // Convite para identidade já confirmada: login por código de e-mail.
    await page
      .getByRole('button', { name: 'Acessar conta existente por código', exact: true })
      .click()
    await page.getByLabel('E-mail', { exact: true }).fill(f.email)
    let creation: boolean | undefined
    page.on('request', (request) => {
      if (request.url().includes('/auth/v1/otp') && request.method() === 'POST')
        creation = request.postDataJSON().create_user
    })
    await page.getByRole('button', { name: 'Enviar código por e-mail' }).click()
    // Sem SMTP, o GoTrue local recusa envio; a interface permite usar código obtido previamente.
    await expect(page.getByRole('alert')).toContainText(
      'Não foi possível solicitar o código'
    )
    expect(creation).toBe(false)
    await page.getByRole('button', { name: 'Já tenho um código' }).click()
    await page.getByLabel('E-mail', { exact: true }).clear()
    await page.getByLabel('E-mail', { exact: true }).fill(f.email)
    await expect(page.getByLabel('Código do e-mail')).toBeVisible()
    // O pedido OTP real gera outro token; obtém o código da fixture via Admin, sem caixa SMTP.
    const latest = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: f.email
    })
    expect(latest.error).toBeNull()
    await page
      .getByLabel('Código do e-mail')
      .fill(latest.data.properties.email_otp)
    await page.getByRole('button', { name: 'Validar código' }).click()
    await expect(page).toHaveURL(new RegExp(`/convites/${f.id}$`))
    await expect(page.getByRole('heading', { name: 'Seu convite' })).toBeVisible()
    await page.getByRole('button', { name: 'Aceitar convite' }).click()
    await expect(
      page.getByText('Convite aceito. Seu acesso está disponível.')
    ).toBeVisible()
    await page.goto(`${root}launch/clinica-aurora`)
    await expect(page.getByRole('heading', { name: /Aurora/ })).toBeVisible()
    const membership = await a
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', A)
      .eq('user_id', f.user.id)
      .single()
    expect(
      (
        await a.rpc('revoke_membership', {
          tenant: A,
          membership: membership.data.id
        })
      ).error
    ).toBeNull()
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(
      page.getByText('Acesso negado ou clínica indisponível.')
    ).toBeVisible()
    await expect(page.getByLabel('Unidade ativa')).toHaveCount(0)
  } finally {
    for (const fn of callbacks) await fn()
  }
})
test('iframe apresenta abertura externa e não inicia login', async ({
  page
}) => {
  await page.goto(`${root}launch`)
  await page.evaluate((root) => {
    const frame = document.createElement('iframe')
    frame.src = `${root}launch/clinica-aurora`
    frame.title = 'FLW de teste sem integração'
    document.body.appendChild(frame)
  }, root)
  const frame = page.frameLocator('iframe')
  await expect(
    frame.getByRole('link', { name: 'Abrir em aba externa' })
  ).toHaveAttribute('target', '_blank')
  await expect(frame.getByLabel('E-mail', { exact: true })).toHaveCount(0)
})

test('convite novo usa código invite real e rejeita código incorreto', async ({
  page
}) => {
  const a = await login('a@example.com')
  const admin = client(localConfig().service)
  const email = `invite-ui-${crypto.randomUUID()}@example.com`
  const invitation = await a.rpc('invite_member', {
    tenant: A,
    unit: '10000000-0000-0000-0000-000000000011',
    email,
    clinic_role: 'manager'
  })
  expect(invitation.error).toBeNull()
  const generated = await admin.auth.admin.generateLink({
    type: 'invite',
    email
  })
  expect(generated.error).toBeNull()
  try {
    await page.goto(`${root}convites/${invitation.data}`)
    await page.getByLabel('E-mail', { exact: true }).fill(email)
    await page.getByLabel('Código do e-mail').fill('0000000000')
    await page.getByRole('button', { name: 'Validar código' }).click()
    await expect(page.getByRole('alert')).toContainText(
      'Código inválido, expirado ou já utilizado'
    )
    await page
      .getByLabel('Código do e-mail')
      .fill(generated.data.properties.email_otp)
    await page.getByRole('button', { name: 'Validar código' }).click()
    await page.getByRole('button', { name: 'Aceitar convite' }).click()
    await expect(
      page.getByText('Convite aceito. Seu acesso está disponível.')
    ).toBeVisible()
    await page.goto(`${root}launch`)
    await expect(page).toHaveURL(/\/clinicas\/clinica-aurora$/)
  } finally {
    expect(
      (await admin.auth.admin.deleteUser(generated.data.user.id)).error
    ).toBeNull()
  }
})

test('launch renova JWT expirado e recusa refresh revogado após logout', async ({
  page
}) => {
  const a = await login('a@example.com')
  const session = (await a.auth.getSession()).data.session
  const expired = expiredSession(session)
  await page.goto(`${root}launch`)
  await page.evaluate(
    (value) =>
      localStorage.setItem('sb-localhost-auth-token', JSON.stringify(value)),
    expired
  )
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().includes('/auth/v1/token?grant_type=refresh_token') &&
      response.status() === 200
  )
  await page.goto(`${root}launch/clinica-aurora`)
  await refreshed
  await expect(page.getByRole('heading', { name: /Aurora/ })).toBeVisible()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Acesse seu espaço' })
  ).toBeVisible()
  await page.evaluate(
    (value) =>
      localStorage.setItem('sb-localhost-auth-token', JSON.stringify(value)),
    expired
  )
  await page.goto(`${root}launch/clinica-aurora`)
  await expect(
    page.getByRole('heading', { name: 'Acesse seu espaço' })
  ).toBeVisible()
  await expect(page.getByLabel('Unidade ativa')).toHaveCount(0)
})

test('logout com erro remoto remove sessão persistida antes de recarregar', async ({ page }) => {
  await page.goto(`${root}launch/clinica-aurora`)
  await enter(page, 'a@example.com')
  await expect(page.getByLabel('Unidade ativa')).toBeVisible()
  await page.route('**/auth/v1/logout*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"indisponível"}' }))
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Revogação remota não confirmada')
  expect(await page.evaluate(() => localStorage.getItem('sb-localhost-auth-token'))).toBeNull()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Acesse seu espaço' })).toBeVisible()
  await expect(page.getByLabel('Unidade ativa')).toHaveCount(0)
})

test('erro de link Auth permanece visível com sessão inicial existente', async ({ page }) => {
  await page.goto(`${root}launch/clinica-aurora`)
  await enter(page, 'a@example.com')
  await expect(page.getByLabel('Unidade ativa')).toBeVisible()
  await page.goto(`${root}launch/clinica-aurora#error=access_denied&error_code=otp_expired`)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Link de autenticação inválido ou expirado')
  await expect(page.getByLabel('Unidade ativa')).toBeVisible()
})
