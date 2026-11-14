import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import { createClient, type Session } from '@supabase/supabase-js'
import { publicKey } from './public-key'
import type { Database } from './database.types'
import './style.css'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const db = url && key && publicKey(key) ? createClient<Database>(url, key) : null

type Tenant = Database['public']['Tables']['tenants']['Row']
type Unit = Database['public']['Tables']['units']['Row']
function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!db)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!db) return
    let live = true
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, value) => { if (live) { setSession(value); if (value) setError('') } })
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
    try {
      const result = await db!.auth.signOut()
      if (result.error) throw result.error
    } catch {
      try { await db!.auth.signOut({ scope: 'local' }) } catch { /* A interface deve permitir nova autenticação. */ }
      setError('Sessão local encerrada. Revogação remota não confirmada.')
    } finally { setSession(null) }
  }
  return <><a className="skip" href="#conteudo">Ir para o conteúdo</a><header><Link className="brand" to="/"><span className="logo">Z</span>Zetta <span className="brand-detail">Gestão Estética</span></Link>{session && <button onClick={logout}>Sair</button>}</header><main id="conteudo"><p className="eyebrow">GESTÃO MULTIEMPRESA</p><h1>Seu cuidado começa<br />com uma boa gestão.</h1>{error && <p role="alert">{error}</p>}{!db ? <section className="glass"><h2>Backend não configurado</h2><p>Configure a URL e a chave pública do Supabase para acessar sua clínica.</p></section> : loading ? <p role="status">Verificando sessão…</p> : !session ? <Login /> : <Routes><Route path="/admin" element={<Platform />} /><Route path="/clinicas/:slug/admin" element={<Clinic admin />} /><Route path="/clinicas/:slug" element={<Clinic />} /><Route path="/convites/:invitation" element={<Invitation />} /><Route path="/" element={<Home />} /><Route path="*" element={<p role="alert">Rota indisponível.</p>} /></Routes>}<footer>Zetta Estética · Acesso seguro por convite</footer></main></>
}
function Login() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  return <section className="glass login"><p className="step">BEM-VINDO À SUA CLÍNICA</p><h2>Acesse seu espaço</h2><p className="muted">Use a conta vinculada ao convite da sua clínica.</p><form onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('')
    const form = new FormData(e.currentTarget)
    try {
      const result = await db!.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) })
      if (result.error) setError('Não foi possível entrar. Confira suas credenciais.')
    } catch { setError('Serviço indisponível. Tente novamente.') } finally { setBusy(false) }
  }}><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" required /><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required /><button className="primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>{error && <p role="alert">{error}</p>}</form></section>
}
function Home() {
  const [rows, setRows] = useState<Tenant[] | null>(null); const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    Promise.resolve(db!.from('tenants').select('*')).then(({ data, error }) => {
      if (!live) return
      if (error) setError('Falha ao carregar clínicas.'); else setRows(data)
    }).catch(() => { if (live) setError('Falha ao carregar clínicas.') })
    return () => { live = false }
  }, [])
  return <section className="glass"><h2>Suas clínicas</h2><p className="muted">Escolha o contexto de trabalho. O acesso considera seus vínculos atuais.</p>{error ? <p role="alert">{error}</p> : !rows ? <p role="status">Carregando clínicas…</p> : !rows.length ? <p>Nenhum vínculo ativo. Solicite um convite ao administrador.</p> : <div className="cards">{rows.map(t => <Link className="tenant-card" key={t.id} to={`/clinicas/${t.slug}`}><span className="chip">CLÍNICA</span><h3>{t.name}</h3><span>Acessar gestão →</span></Link>)}</div>}<p><Link to="/admin">Administração Zetta</Link></p></section>
}
function Clinic({ admin = false }: { admin?: boolean }) {
  const { slug } = useParams(); const [tenant, setTenant] = useState<Tenant | null>(null); const [units, setUnits] = useState<Unit[]>([])
  const [status, setStatus] = useState('Carregando contexto…'); const [unit, setUnit] = useState(''); const [canManage, setCanManage] = useState(false)
  useEffect(() => {
    let live = true; setTenant(null); setUnits([]); setUnit(''); setCanManage(false); setStatus('Carregando contexto…')
    ;(async () => {
      const result = await db!.from('tenants').select('*').eq('slug', slug!).maybeSingle()
      if (!live) return
      if (result.error || !result.data) { setStatus('Acesso negado ou clínica indisponível.'); return }
      const t = result.data
      const u = await db!.from('units').select('*').eq('tenant_id', t.id)
      if (!live) return
      if (u.error) { setStatus('Falha ao carregar unidades.'); return }
      setTenant(t); setUnits(u.data); setUnit(u.data[0]?.id || ''); setStatus('')
    })().catch(() => { if (live) setStatus('Serviço indisponível.') })
    return () => { live = false }
  }, [slug])
  useEffect(() => {
    let live = true; setCanManage(false)
    if (tenant && unit) Promise.resolve(db!.rpc('check_access', { tenant: tenant.id, unit, permission: 'members.manage' })).then(({ data, error }) => { if (live) { setCanManage(!error && data === true); if (error) setStatus('Falha ao verificar permissão.') } }).catch(() => { if (live) { setCanManage(false); setStatus('Falha ao verificar permissão.') } })
    return () => { live = false }
  }, [tenant, unit])
  if (status) return <section className="glass"><p role="status">{status}</p><Link to="/">Voltar às clínicas</Link></section>
  return <section className="glass"><p className="step">CONTEXTO ATIVO</p><h2>{tenant?.name}</h2><label htmlFor="unit">Unidade ativa</label><select id="unit" value={unit} onChange={e => setUnit(e.target.value)}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>{!units.length && <p>Nenhuma unidade autorizada.</p>}{admin ? canManage ? <MemberAdmin tenant={tenant!.id} unit={unit} /> : <p role="alert">Acesso administrativo negado para esta unidade.</p> : <><p>Fundação pronta. Os módulos operacionais serão disponibilizados nas próximas etapas.</p>{canManage && <Link to={`/clinicas/${slug}/admin`}>Administrar equipe</Link>}</>}<p><Link to="/">Trocar clínica</Link></p></section>
}
function MemberAdmin({ tenant, unit }: { tenant: string; unit: string }) {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  return <><h3>Convidar para a unidade</h3><p className="muted">O convite é registrado no banco. O envio pelo Auth é uma tarefa administrativa no servidor.</p><form onSubmit={async e => {
    e.preventDefault(); setBusy(true); const f = new FormData(e.currentTarget)
    try {
      const { data, error } = await db!.rpc('invite_member', { tenant, unit, email: String(f.get('email')), clinic_role: String(f.get('role')) })
      setMessage(error ? 'Convite não autorizado ou inválido.' : `Convite registrado: ${data}. Envio pendente.`)
    } catch { setMessage('Serviço indisponível. Tente novamente.') } finally { setBusy(false) }
  }}><label htmlFor="invite-email">E-mail do convidado</label><input name="email" id="invite-email" type="email" required /><label htmlFor="role">Papel na clínica</label><select id="role" name="role"><option value="reception">Recepção</option><option value="manager">Gerente</option><option value="professional">Profissional</option><option value="finance">Financeiro</option><option value="auditor">Auditoria</option><option value="clinic_admin">Admin da clínica</option></select><button disabled={busy}>Registrar convite</button></form><p role="status">{message}</p></>
}
function Platform() {
  const [status, setStatus] = useState('Verificando permissão…'); const [rows, setRows] = useState<{ id: string; name: string; status: string }[]>([])
  useEffect(() => {
    let live = true
    Promise.resolve(db!.rpc('platform_tenants')).then(({ data, error }) => {
      if (!live) return
      setStatus(error ? 'Acesso restrito à administração Zetta.' : data?.length ? '' : 'Nenhuma clínica cadastrada.'); setRows(data || [])
    }).catch(() => { if (live) setStatus('Falha ao carregar clínicas.') })
    return () => { live = false }
  }, [])
  return <section className="glass"><h2>Administração Zetta</h2><p role="status">{status}</p>{rows.map(t => <p key={t.id}>{t.name} · {t.status}</p>)}<Link to="/">Voltar</Link></section>
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
