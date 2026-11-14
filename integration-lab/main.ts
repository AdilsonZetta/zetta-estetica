import { createClient, type Session } from '@supabase/supabase-js'
import { clinics } from '../fixtures/simulacao/clinics.ts'
import { approvedReturnUrl, capabilityResult, isPublicKey, proofUrl, resolveClinic } from './lab.ts'
import './style.css'

const base = import.meta.env.BASE_URL
let clinic = resolveClinic(location.search)
// A prova não recebe credenciais, SSO ou destino de retorno por URL.
history.replaceState(null, '', `${location.pathname}${clinic ? `?clinic=${clinic.slug}` : '?clinic=desconhecida'}`)
const returnUrl = approvedReturnUrl(import.meta.env.VITE_FLW_RETURN_URL)
const backendUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''
const configured = Boolean(backendUrl && /^https?:\/\//.test(backendUrl) && isPublicKey(publicKey))
const supabase = configured ? createClient(backendUrl!, publicKey, { auth: { detectSessionInUrl: false, storageKey: 'zetta-discovery-auth' } }) : null
let session: Session | null = null
let busy = Boolean(supabase)
let message = ''

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <a class="skip" href="#main">Ir para o conteúdo</a>
  <header><a class="brand" href="${base}integration-lab"><span class="logo" aria-hidden="true">z.</span> zetta<span class="brand-detail">estética</span></a><span class="chip">DISCOVERY · PROMPT 00</span></header>
  <main id="main">
    <section class="intro"><p class="eyebrow">CONEXÕES QUE COMEÇAM COM EVIDÊNCIA</p><h1>Um lugar para provar<br />a integração.</h1><p>Teste a abertura e o login antes de conectar a operação da clínica.</p><div class="notice"><span class="dot" aria-hidden="true"></span><strong>Laboratório com dados fictícios.</strong> Nenhuma operação é enviada à FLW.</div></section>
    <div class="grid">
      <section class="glass"><p class="step">01 / DESTINO</p><h2>Duas clínicas, duas provas</h2><label for="clinic">Clínica de demonstração</label><select id="clinic"><option value="">Selecione uma clínica</option>${clinics.map(c => `<option value="${c.slug}">${c.name}</option>`).join('')}</select><p class="muted">O destino não concede acesso. A validação de vínculo no banco será feita no Prompt 03.</p><div id="fixture" aria-live="polite"></div><div class="actions"><a id="open" class="button primary" target="_blank" rel="noopener noreferrer">Abrir prova em nova aba <span aria-hidden="true">↗</span></a></div><p class="muted">Este link prova apenas a abertura pelo navegador. O ícone Gestão Estética depende de teste na FLW.</p></section>
      <section class="glass"><p class="step">02 / IDENTIDADE</p><h2>Login independente</h2><p id="auth-status" role="status"></p><p class="muted">Supabase Auth. Use somente usuário fictício de homologação. Convite e código por e-mail ficam para o Prompt 03.</p><form id="login"><label for="email">E-mail de teste</label><input id="email" type="email" autocomplete="username" required placeholder="pessoa@example.com" /><label for="password">Senha de teste</label><input id="password" type="password" autocomplete="current-password" required /><button class="primary" id="submit" type="submit">Entrar no laboratório</button></form><button id="logout" hidden>Sair do laboratório</button><p id="auth-message" role="status" aria-live="polite"></p></section>
      <section class="glass"><p class="step">03 / CAPACIDADE</p><h2>Integração em observação</h2><p>Consulta de contato, card, tarefa, pagamento e automação aguardam provas autenticadas.</p><button id="capability">Verificar estado da operação</button><p id="capability-result" role="status"></p><p class="muted">Alternativa: localizar a referência na FLW e concluir a tarefa manual com a equipe da clínica.</p></section>
      <section class="glass"><p class="step">04 / RETORNO</p><h2>Continue o atendimento</h2><p id="context"></p><div id="return"></div><p class="muted">Aba, iframe, sessão em mobile e retorno real precisam ser observados em duas contas FLW autorizadas.</p><span class="chip">Ícone FLW · pendente</span></section>
    </div>
    <footer>Prova isolada e reaproveitável · Zetta Estética <span>Dados sintéticos / sem conexão FLW</span></footer>
  </main>`

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const select = $<HTMLSelectElement>('#clinic')
function renderClinic() {
  select.value = clinic?.slug ?? ''
  const fixture = $('#fixture')
  fixture.replaceChildren()
  if (clinic) {
    const dl = document.createElement('dl')
    for (const [label, value] of [['Conta simulada', clinic.account], ['Contato fictício', clinic.contact], ['Referência manual', clinic.card], ['Próximo passo', clinic.task]]) {
      const dt = document.createElement('dt'); dt.textContent = label
      const dd = document.createElement('dd'); dd.textContent = value
      dl.append(dt, dd)
    }
    fixture.append(dl)
  } else { fixture.textContent = 'Destino desconhecido. Selecione uma das clínicas fictícias.' }
  const open = $<HTMLAnchorElement>('#open')
  open.hidden = !clinic
  if (clinic) open.href = proofUrl(location.origin, base, clinic.slug)
  else open.removeAttribute('href')
}
select.addEventListener('change', () => {
  clinic = clinics.find(c => c.slug === select.value) ?? null
  history.replaceState(null, '', `${base}integration-lab?clinic=${clinic?.slug ?? 'desconhecida'}`)
  $('#capability-result').textContent = ''
  renderClinic()
})
renderClinic()

$('#context').textContent = window.self === window.top ? 'Página aberta em contexto de navegação principal.' : 'Página incorporada. Isso não comprova suporte a iframe na FLW.'
if (returnUrl) {
  const link = document.createElement('a'); link.href = returnUrl; link.textContent = 'Voltar à FLW'; link.className = 'button'; link.target = '_blank'; link.rel = 'noopener noreferrer'
  $('#return').append(link)
} else { $('#return').textContent = 'Retorno à FLW não configurado. Retome a aba de atendimento aberta.' }
$('#capability').addEventListener('click', () => {
  const result = capabilityResult()
  $('#capability-result').textContent = `${result.code} · SIMULAÇÃO. ${result.message}`
})

function renderAuth() {
  $('#auth-status').textContent = !supabase ? 'Backend não configurado' : busy ? 'Verificando sessão…' : session ? 'Identidade autenticada · vínculo da clínica ainda não validado' : 'Sem sessão ativa'
  $<HTMLFormElement>('#login').hidden = Boolean(session)
  $<HTMLButtonElement>('#logout').hidden = !session
  for (const input of document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('#login input, #login button, #logout')) input.disabled = !supabase || busy
  $('#auth-message').textContent = message
}
renderAuth()
$('#login').addEventListener('submit', async event => {
  event.preventDefault()
  if (!supabase || busy) return
  busy = true; message = ''; renderAuth()
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: $<HTMLInputElement>('#email').value, password: $<HTMLInputElement>('#password').value })
    if (error) throw error
    session = data.session
  } catch { message = 'Não foi possível entrar. Confira as credenciais de teste e a conexão.' }
  finally { $<HTMLInputElement>('#password').value = ''; busy = false; renderAuth() }
})
$('#logout').addEventListener('click', async () => {
  if (!supabase || busy) return
  busy = true; message = ''; renderAuth()
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    session = null
    message = 'Sessão encerrada neste laboratório.'
  } catch {
    // O SDK remove o estado persistido antes da revogação remota no escopo local.
    await supabase.auth.signOut({ scope: 'local' })
    session = null
    message = 'Sessão encerrada neste laboratório. Revogação remota não confirmada.'
  }
  finally { busy = false; renderAuth() }
})

async function initializeAuth() {
  if (!supabase) return
  supabase.auth.onAuthStateChange((event, current) => {
    if (event === 'INITIAL_SESSION') return // A restauração inicial precisa da checagem no servidor.
    session = current
    renderAuth()
  })
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (data.session) {
      const verified = await supabase.auth.getUser()
      if (verified.error || !verified.data.user) throw verified.error ?? new Error('Identidade indisponível')
      session = data.session
    }
  } catch {
    session = null
    message = 'Não foi possível verificar a sessão. Tente entrar novamente.'
  } finally { busy = false; renderAuth() }
}
void initializeAuth()
