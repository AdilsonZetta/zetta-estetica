import { ClinicClients } from './clients'
import { ClinicIntegrations } from './integrations'
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useParams, useLocation } from 'react-router-dom'
import { createClient, type Session } from '@supabase/supabase-js'
import { publicKey } from './public-key'
import type { Database } from './database.types'
import './style.css'
import { Launch } from './launch'
import { Login } from './login'
import { clearTenantContext, trackPreview, releasePreview, registerContextCleanup } from './context'
import { PlatformConsole, ClinicModules } from './console'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const embedded = (() => {
  try { return window.self !== window.top } catch { return true }
})()
const db = !embedded && url && key && publicKey(key) ? createClient<Database>(url, key) : null

type Tenant = Database['public']['Tables']['tenants']['Row']
type Unit = Database['public']['Tables']['units']['Row']
function App() {
  const location = useLocation()
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    if (!/^\/(clinicas|launch)(\/|$)/.test(location.pathname)) return
    const reset = () => { clearTenantContext(); void db?.removeAllChannels(); setEpoch(v => v + 1) }
    window.addEventListener('focus', reset)
    const interval = window.setInterval(reset, 60_000)
    return () => { window.removeEventListener('focus', reset); window.clearInterval(interval) }
  }, [location.pathname])
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => () => { clearTenantContext(); void db?.removeAllChannels() }, [location.pathname, session?.user.id])
  const [loading, setLoading] = useState(!!db)
  const [error, setError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).has('error') ? 'Link de autenticação inválido ou expirado. Solicite um novo convite ou código.' : '')
  useEffect(() => {
    if (!db) return
    let live = true
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, value) => { if (live) { if (_event === 'SIGNED_OUT') { clearTenantContext(); void db?.removeAllChannels(); setEpoch(v => v + 1) }; setSession(value); if (value && _event === 'SIGNED_IN') setError('') } })
    db.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const result = await db!.auth.getUser()
        if (result.error) { await db!.auth.signOut({ scope: 'local' }); if (live) setError('Sessão inválida. Entre novamente.') }
        else if (live) setSession(data.session)
      }
      if (live) setLoading(false)
    }).catch(() => { if (live) { setError('Não foi possível verificar a sessão.'); setLoading(false) } })
    return () => { live = false; subscription.unsubscribe() }
  }, [])
  async function logout() {
    clearTenantContext(); void db?.removeAllChannels()
    try {
      const result = await db!.auth.signOut()
      if (result.error) throw result.error
    } catch {
      try { await db!.auth.signOut({ scope: 'local' }) } catch { /* A interface deve permitir nova autenticação. */ }
      setError('Sessão local encerrada. Revogação remota não confirmada.')
    } finally { setSession(null) }
  }
  if (embedded) return <main><section className="glass"><h1>Abra a gestão em uma aba externa</h1><p>A sessão em iframe depende de homologação de origens e dispositivos.</p><a href={window.location.href} target="_blank" rel="noopener noreferrer">Abrir em aba externa</a></section></main>
  return <><a className="skip" href="#conteudo">Ir para o conteúdo</a><header><Link className="brand" to="/"><span className="logo">Z</span>Zetta <span className="brand-detail">Gestão Estética</span></Link>{session && <button onClick={logout}>Sair</button>}</header><main id="conteudo"><p className="eyebrow">GESTÃO MULTIEMPRESA</p><h1>Seu cuidado começa<br />com uma boa gestão.</h1>{error && <p role="alert">{error}</p>}{!db ? <section className="glass"><h2>Backend não configurado</h2><p>Configure a URL e a chave pública do Supabase para acessar sua clínica.</p></section> : loading ? <p role="status">Verificando sessão…</p> : !session ? <Login db={db} key={location.pathname} /> : <Routes key={`${session.user.id}:${location.pathname}:${epoch}`}><Route path="/launch" element={<Launch db={db!} />} /><Route path="/launch/:slug" element={<Launch db={db!} />} /><Route path="/exportacao" element={<ExportChannel />} /><Route path="/admin" element={<PlatformConsole db={db!} />} /><Route path="/clinicas/:slug/clientes" element={<Clinic clients />} /><Route path="/clinicas/:slug/admin" element={<Clinic admin />} /><Route path="/clinicas/:slug/modulos/:module" element={<Clinic />} /><Route path="/clinicas/:slug" element={<Clinic />} /><Route path="/convites/:invitation" element={<Invitation />} /><Route path="/" element={<Home />} /><Route path="*" element={<p role="alert">Rota indisponível.</p>} /></Routes>}<footer>Zetta Estética · Acesso seguro por convite</footer></main></>
}

function Home() {
  const [rows, setRows] = useState<Tenant[] | null>(null); const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    const controller = new AbortController()
    const unregister = registerContextCleanup(() => controller.abort())
    Promise.resolve(db!.from('tenants').select('*').abortSignal(controller.signal)).then(({ data, error }) => {
      if (!live) return
      if (error) setError('Falha ao carregar clínicas.'); else setRows(data)
    }).catch(() => { if (live) setError('Falha ao carregar clínicas.') })
    return () => { live = false; controller.abort(); unregister() }
  }, [])
  return <section className="glass"><h2>Suas clínicas</h2><p className="muted">Escolha o contexto de trabalho. O acesso considera seus vínculos atuais.</p>{error ? <p role="alert">{error}</p> : !rows ? <p role="status">Carregando clínicas…</p> : !rows.length ? <p>Nenhum vínculo ativo. Solicite um convite ao administrador.</p> : <div className="cards">{rows.map(t => <Link className="tenant-card" key={t.id} to={`/clinicas/${t.slug}`}><span className="chip">CLÍNICA</span><h3>{t.name}</h3><span>Acessar gestão →</span></Link>)}</div>}<p><Link to="/admin">Administração Zetta</Link> · <Link to="/exportacao">Exportação autorizada por contrato</Link></p></section>
}
function Clinic({ admin = false, clients = false }: { admin?: boolean; clients?: boolean }) {
  const { slug, module } = useParams(); const [tenant, setTenant] = useState<Tenant | null>(null); const [units, setUnits] = useState<Unit[]>([])
  const [status, setStatus] = useState('Carregando contexto…'); const [unit, setUnit] = useState(''); const [canManage, setCanManage] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const unregister = registerContextCleanup(() => controller.abort())
    let live = true; setTenant(null); setUnits([]); setUnit(''); setCanManage(false); setStatus('Carregando contexto…')
    ;(async () => {
      const result = await db!.from('tenants').select('*').eq('slug', slug!).abortSignal(controller.signal).maybeSingle()
      if (!live) return
      if (result.error || !result.data) { setStatus('Acesso negado ou clínica indisponível.'); return }
      const t = result.data
      const u = await db!.from('units').select('*').eq('tenant_id', t.id).abortSignal(controller.signal)
      if (!live) return
      if (u.error) { setStatus('Falha ao carregar unidades.'); return }
      setTenant(t); setUnits(u.data); setUnit(u.data[0]?.id || ''); setStatus('')
    })().catch(() => { if (live) setStatus('Serviço indisponível.') })
    return () => { live = false; controller.abort(); unregister() }
  }, [slug])
  useEffect(() => {
    let live = true; setCanManage(false)
    if (tenant && unit) Promise.resolve(db!.rpc('check_access', { tenant: tenant.id, unit, permission: 'members.manage' })).then(({ data, error }) => { if (live) { setCanManage(!error && data === true); if (error) setStatus('Falha ao verificar permissão.') } }).catch(() => { if (live) { setCanManage(false); setStatus('Falha ao verificar permissão.') } })
    return () => { live = false }
  }, [tenant, unit])
  if (status) return <section className="glass"><p role="status">{status}</p><Link to="/">Voltar às clínicas</Link></section>
  return <section className="glass"><p className="step">CONTEXTO ATIVO</p><h2>{tenant?.name}</h2><label htmlFor="unit">Unidade ativa</label><select id="unit" value={unit} onChange={e => { clearTenantContext(); void db?.removeAllChannels(); setUnit(e.target.value) }}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>{!units.length && <p>Nenhuma unidade autorizada.</p>}{unit && (clients ? <ClinicClients key={`clients:${unit}`} db={db!} tenant={tenant!.id} unit={unit} /> : admin ? canManage ? <><MemberAdmin key={`members:${unit}`} tenant={tenant!.id} unit={unit} /><ClinicIntegrations key={`flw:${unit}`} db={db!} tenant={tenant!.id} unit={unit} /><ClinicModules key={`modules:${unit}`} db={db!} tenant={tenant!.id} unit={unit} admin /></> : <p role="alert">Acesso administrativo negado para esta unidade.</p> : <><ClinicModules key={`modules:${unit}`} db={db!} tenant={tenant!.id} unit={unit} admin={false} selectedModule={module} />{canManage && <Link to={`/clinicas/${slug}/admin`}>Administrar equipe</Link>}</>)}<p><Link to={`/clinicas/${slug}/clientes`}>Clientes</Link> · {clients && <><Link to={`/clinicas/${slug}`}>Voltar à clínica</Link> · </>}<Link to="/">Trocar clínica</Link></p></section>
}
function MemberAdmin({ tenant, unit }: { tenant: string; unit: string }) {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  return <><h3>Convidar para a unidade</h3><p className="muted">O convite é registrado no banco. O envio pelo Auth é uma tarefa administrativa no servidor; o destinatário pode usar o código do e-mail.</p><form onSubmit={async e => {
    e.preventDefault(); setBusy(true); const f = new FormData(e.currentTarget)
    try {
      const { data, error } = await db!.rpc('invite_member', { tenant, unit, email: String(f.get('email')), clinic_role: String(f.get('role')) })
      setMessage(error ? 'Convite não autorizado ou inválido.' : `Convite registrado: ${data}. Envio pendente.`)
    } catch { setMessage('Serviço indisponível. Tente novamente.') } finally { setBusy(false) }
  }}><label htmlFor="invite-email">E-mail do convidado</label><input name="email" id="invite-email" type="email" required /><label htmlFor="role">Papel na clínica</label><select id="role" name="role"><option value="reception">Recepção</option><option value="manager">Gerente</option><option value="professional">Profissional</option><option value="finance">Financeiro</option><option value="auditor">Auditoria</option><option value="clinic_admin">Admin da clínica</option></select><button disabled={busy}>Registrar convite</button></form><p role="status">{message}</p></>
}
function ExportChannel() {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  return <section className="glass"><h2>Exportação autorizada por contrato</h2><p>Canal de metadados da empresa e das unidades atribuídas. Exige concessão temporária para seu usuário e janela contratual, inclusive durante suspensão.</p><form onSubmit={async e => {
    e.preventDefault(); setBusy(true)
    try { const tenant = String(new FormData(e.currentTarget).get('tenant')); const r = await db!.rpc('export_tenant_metadata', { tenant }); if (r.error) setMessage('Exportação não autorizada ou janela expirada. Contate a Zetta.'); else {
      const url = trackPreview(URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }))); const a = document.createElement('a'); a.href = url; a.download = 'zetta-metadados.json'; a.click(); window.setTimeout(() => releasePreview(url), 1000); setMessage('Exportação gerada e auditada.')
    } } catch { setMessage('Serviço indisponível. Tente novamente.') } finally { setBusy(false) }
  }}><label htmlFor="export-tenant">UUID da empresa autorizada</label><input id="export-tenant" name="tenant" required /><button disabled={busy}>Exportar metadados autorizados</button></form><p role="status">{message}</p><Link to="/">Voltar</Link></section>
}
function Invitation() {
  const { invitation } = useParams(); const [message, setMessage] = useState('Confirme o convite para vincular sua conta à unidade.'); const [busy, setBusy] = useState(false)
  return <section className="glass"><h2>Seu convite</h2><p role="status">{message}</p><form onSubmit={async e => {
    e.preventDefault(); setBusy(true)
    const password = String(new FormData(e.currentTarget).get('password'))
    try {
      if (password) {
        const pwd = await db!.auth.updateUser({ password })
        if (pwd.error) { setMessage('Não foi possível definir a senha. Verifique os requisitos e tente novamente.'); return }
      }
      const result = await db!.rpc('accept_invitation', { invitation: invitation! })
      setMessage(result.error ? 'Não foi possível aceitar o convite. Verifique a conta, validade e vínculo com o administrador.' : 'Convite aceito. Seu acesso está disponível.')
    } catch { setMessage('Serviço indisponível. Tente novamente.') } finally { setBusy(false) }
  }}><label htmlFor="new-password">Defina sua senha (opcional)</label><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} /><p className="muted">Se você já possui senha, deixe o campo vazio para mantê-la.</p><button disabled={busy}>Aceitar convite</button></form><Link to="/">Ver clínicas</Link></section>
}

createRoot(document.getElementById('app')!).render(<React.StrictMode><BrowserRouter basename={import.meta.env.BASE_URL}><App /></BrowserRouter></React.StrictMode>)
