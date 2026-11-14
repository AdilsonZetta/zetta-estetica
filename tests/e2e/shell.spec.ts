import { test, expect, type Page } from '@playwright/test'
// @ts-expect-error suporte exclusivamente Node
import { login, invitedFixture, A } from '../foundation-support.mjs'
const root='/zetta-estetica/'
async function enter(page: Page,email: string) {
  await page.getByLabel('E-mail',{exact:true}).fill(email)
  await page.getByLabel('Senha',{exact:true}).fill('Demo@123456')
  await page.getByRole('button',{name:'Entrar',exact:true}).click()
}
test('rota de administração exige login e vínculo autorizado no banco', async ({page})=>{
  await page.goto(`${root}clinicas/clinica-aurora/admin`)
  await expect(page.getByRole('heading',{name:'Acesse seu espaço'})).toBeVisible()
  await enter(page,'b@example.com')
  await expect(page.getByText('Acesso negado ou clínica indisponível.')).toBeVisible()
  await page.goto(`${root}admin`)
  await expect(page.getByText('Acesso restrito à administração Zetta.')).toBeVisible()
})
test('admin A vê somente sua unidade e registra convite',async ({page})=>{
  await page.goto(root); await enter(page,'a@example.com')
  await expect(page.getByRole('heading',{name:'Suas clínicas'})).toBeVisible()
  await expect(page.getByRole('link',{name:/Horizonte/})).toHaveCount(0)
  await page.getByRole('link',{name:/Aurora/}).click()
  await expect(page.getByLabel('Unidade ativa')).toHaveValue('10000000-0000-0000-0000-000000000011')
  await expect(page.getByLabel('Unidade ativa').locator('option')).toHaveCount(1)
  await page.getByRole('link',{name:'Administrar equipe'}).click()
  await page.getByLabel('E-mail do convidado').fill('convite-ui@example.com')
  await page.route('**/rest/v1/rpc/invite_member',route=>route.abort('failed'))
  await page.getByRole('button',{name:'Registrar convite'}).click()
  await expect(page.getByRole('status')).toContainText('Convite não autorizado ou inválido.')
  await expect(page.getByRole('button',{name:'Registrar convite'})).toBeEnabled()
  await page.unroute('**/rest/v1/rpc/invite_member')
  await page.getByRole('button',{name:'Registrar convite'}).click()
  await expect(page.getByRole('status')).toContainText('Convite registrado:')
  // Revogar pendências de teste com sessão administrativa de usuário.
  const a=await login('a@example.com')
  const {data}=await a.from('tenant_invitations').select('id').eq('tenant_id',A).eq('email','convite-ui@example.com').is('revoked_at',null)
  for(const row of data || []) await a.rpc('revoke_invitation',{tenant:A,invitation:row.id})
  await page.getByRole('button',{name:'Sair',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Acesse seu espaço'})).toBeVisible()
})
test('usuário multiempresa troca contexto e gerente não acessa administração',async ({page})=>{
  await page.goto(root); await enter(page,'multi@example.com')
  await expect(page.getByRole('link',{name:/Aurora/})).toBeVisible()
  await expect(page.getByRole('link',{name:/Horizonte/})).toBeVisible()
  await page.getByRole('link',{name:/Horizonte/}).click()
  await expect(page.getByRole('heading',{name:/Horizonte/})).toBeVisible()
  await expect(page.getByLabel('Unidade ativa')).toHaveValue('20000000-0000-0000-0000-000000000011')
  await page.goto(`${root}clinicas/clinica-aurora/admin`)
  await expect(page.getByText('Acesso administrativo negado para esta unidade.')).toBeVisible()
})
test('usuário revogado autentica identidade mas não abre clínica nem rota administrativa',async ({page})=>{
  await page.goto(root); await enter(page,'revogado@example.com')
  await expect(page.getByText('Nenhum vínculo ativo.',{exact:false})).toBeVisible()
  await page.goto(`${root}clinicas/clinica-aurora/admin`)
  await expect(page.getByText('Acesso negado ou clínica indisponível.')).toBeVisible()
})
test('aceite no shell usa sessão Auth por convite e mostra acesso à clínica',async ({page})=>{
  const callbacks: (()=>Promise<void>)[]=[]
  const a=await login('a@example.com')
  const f=await invitedFixture({after:(fn:()=>Promise<void>)=>callbacks.push(fn)},a)
  try {
    await page.goto(root)
    const session=(await f.invited.auth.getSession()).data.session
    await page.evaluate(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),session)
    await page.goto(`${root}convites/${f.id}`)
    await page.getByLabel('Defina sua senha (opcional)').fill('Demo@12345678')
    await page.getByRole('button',{name:'Aceitar convite'}).click()
    await expect(page.getByText('Convite aceito. Seu acesso está disponível.')).toBeVisible()
    await page.getByRole('link',{name:'Ver clínicas'}).click()
    await expect(page.getByRole('link',{name:/Aurora/})).toBeVisible()
  } finally { for(const fn of callbacks) await fn() }
})

test('aceite sem nova senha preserva credencial existente e permite repetir após falha',async ({page})=>{
  const callbacks: (()=>Promise<void>)[]=[]
  const f=await invitedFixture({after:(fn:()=>Promise<void>)=>callbacks.push(fn)},await login('a@example.com'))
  try {
    const password='SenhaExistente@123'
    const updated=await f.invited.auth.updateUser({password})
    expect(updated.error).toBeNull()
    await page.goto(root)
    await page.evaluate(value=>localStorage.setItem('sb-localhost-auth-token',JSON.stringify(value)),(await f.invited.auth.getSession()).data.session)
    let passwordUpdates=0
    page.on('request',request=>{if(request.method()==='PUT' && request.url().includes('/auth/v1/user')) passwordUpdates++})
    await page.goto(`${root}convites/${f.id}`)
    await page.route('**/rest/v1/rpc/accept_invitation',route=>route.abort('failed'))
    await page.getByRole('button',{name:'Aceitar convite'}).click()
    await expect(page.getByText('Não foi possível aceitar o convite.',{exact:false})).toBeVisible()
    await expect(page.getByRole('button',{name:'Aceitar convite'})).toBeEnabled()
    await page.unroute('**/rest/v1/rpc/accept_invitation')
    await page.getByRole('button',{name:'Aceitar convite'}).click()
    await expect(page.getByText('Convite aceito. Seu acesso está disponível.')).toBeVisible()
    expect(passwordUpdates).toBe(0)
  } finally {for(const fn of callbacks) await fn()}
})

test('falhas nas consultas de clínicas e permissões apresentam estado final',async ({page})=>{
  await page.goto(root); await enter(page,'a@example.com')
  await expect(page.getByRole('heading',{name:'Suas clínicas'})).toBeVisible()
  await page.route('**/rest/v1/tenants?*',route=>route.abort('failed'))
  await page.reload()
  // O SDK repete GETs após falha de transporte com backoff de 1, 2 e 4 segundos.
  await expect(page.getByText('Falha ao carregar clínicas.')).toBeVisible({timeout:15000})
  await page.unroute('**/rest/v1/tenants?*')
  await page.route('**/rest/v1/rpc/console_snapshot',route=>route.abort('failed'))
  await page.goto(`${root}admin`)
  await expect(page.getByText('Acesso restrito à administração Zetta.')).toBeVisible()
  await page.route('**/rest/v1/rpc/check_access',route=>route.abort('failed'))
  await page.goto(`${root}clinicas/clinica-aurora/admin`)
  await expect(page.getByText('Falha ao verificar permissão.')).toBeVisible()
})

test('logout com falha remota limpa sessão local e erro desaparece no novo login',async ({page})=>{
  await page.goto(root); await enter(page,'a@example.com')
  await expect(page.getByRole('heading',{name:'Suas clínicas'})).toBeVisible()
  await page.route('**/auth/v1/logout*',route=>route.fulfill({status:500,contentType:'application/json',body:'{"message":"indisponível"}'}))
  await page.getByRole('button',{name:'Sair',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Acesse seu espaço'})).toBeVisible()
  await expect(page.getByText('Sessão local encerrada.',{exact:false})).toBeVisible()
  expect(await page.evaluate(()=>localStorage.getItem('sb-localhost-auth-token'))).toBeNull()
  await page.unroute('**/auth/v1/logout*')
  await enter(page,'a@example.com')
  await expect(page.getByRole('heading',{name:'Suas clínicas'})).toBeVisible()
  await expect(page.getByText('Sessão local encerrada.',{exact:false})).toHaveCount(0)
})
