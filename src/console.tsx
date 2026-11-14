import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from './database.types'

type DB = SupabaseClient<Database>
type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
type Invitation = {
  id: string
  email: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  delivery: string
  attempts: number
  last_code: string | null
}
type Company = Row<'tenants'> & {
  configuration: Row<'tenant_configuration'>
  subscription: Row<'tenant_subscriptions'>
  connection: Row<'tenant_connections'>
  units: Row<'units'>[]
  entitlements: Row<'tenant_entitlements'>[]
  invitations: Invitation[]
}
type Snapshot = {
  tenants: Company[]
  modules: Row<'module_catalog'>[]
  plans: Row<'plans'>[]
  plan_modules: Row<'plan_modules'>[]
  support: Row<'support_grants'>[]
  audit: Row<'audit_logs'>[]
}
const sections = [
  'Empresas',
  'Onboarding',
  'Catálogo de módulos',
  'Instalações de ícone',
  'Conexões',
  'Assinaturas SaaS',
  'Suporte'
]
const date = (v?: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR') : 'Pendente'
const field = (f: FormData, k: string) => String(f.get(k) || '').trim()
const message = (error: { message: string }) =>
  error.message || 'Operação indisponível. Tente novamente.'

export function PlatformConsole({ db }: { db: DB }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [tab, setTab] = useState(sections[0])
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('Verificando permissão…')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [diagnostic, setDiagnostic] = useState<Json>(null)
  const [request, setRequest] = useState(() => crypto.randomUUID())
  async function refresh() {
    const { data, error } = await db.rpc('console_snapshot')
    if (error) throw error
    setSnapshot(data as unknown as Snapshot)
    setStatus('')
  }
  useEffect(() => {
    let live = true
    Promise.resolve(db.rpc('console_snapshot'))
      .then(({ data, error }) => {
        if (!live) return
        if (error) {
          setStatus('Acesso restrito à administração Zetta.')
          return
        }
        setSnapshot(data as unknown as Snapshot)
        setStatus('')
      })
      .catch(() => {
        if (live)
          setStatus('Falha ao carregar clínicas. Tente recarregar a página.')
      })
    return () => {
      live = false
    }
  }, [db])
  async function run(
    action: () => PromiseLike<{ error: { message: string } | null }>,
    success = 'Alteração registrada na trilha.'
  ) {
    setBusy(true)
    setNotice('')
    try {
      const result = await action()
      await refresh()
      if (result.error) throw result.error
      setNotice(success)
    } catch (e) {
      setNotice(message(e as { message: string }))
    } finally {
      setBusy(false)
    }
  }
  function submit(
    action: (f: FormData) => PromiseLike<{ error: { message: string } | null }>,
    success?: string
  ) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      void run(() => action(f), success)
    }
  }
  const tenant = snapshot?.tenants.find((t) => t.id === selected)
  if (!snapshot)
    return (
      <section className="glass">
        <h2>Administração Zetta</h2>
        <p role="status">{status}</p>
        <Link to="/">Voltar</Link>
      </section>
    )
  return (
    <section className="glass console">
      <p className="step">CONSOLE ZETTA</p>
      <h2>Administração Zetta</h2>
      <nav aria-label="Console Zetta">
        {sections.map((s) => (
          <button
            key={s}
            aria-current={tab === s ? 'page' : undefined}
            onClick={() => {
              setTab(s)
              setNotice('')
              setDiagnostic(null)
            }}
          >
            {s}
          </button>
        ))}
      </nav>
      <p role="status" aria-live="polite">
        {busy ? 'Processando…' : notice}
      </p>
      {tab !== 'Onboarding' && tab !== 'Catálogo de módulos' && (
        <>
          <label htmlFor="console-tenant">Empresa em revisão</label>
          <select
            id="console-tenant"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value)
              setDiagnostic(null)
            }}
          >
            <option value="">Selecione uma empresa</option>
            {snapshot.tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.status === 'active' ? 'Ativa' : 'Suspensa'}
              </option>
            ))}
          </select>
        </>
      )}
      <div>
        {!tenant &&
          [
            'Instalações de ícone',
            'Conexões',
            'Assinaturas SaaS',
            'Suporte'
          ].includes(tab) && (
            <p>Selecione uma empresa para consultar e alterar esta seção.</p>
          )}
        {tab === 'Empresas' && (
          <>
            <label htmlFor="company-search">Buscar nome, plano ou estado</label>
            <input
              id="company-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {!snapshot.tenants.length && (
              <p>Nenhuma empresa cadastrada. Inicie pelo onboarding.</p>
            )}
            <div className="cards">
              {snapshot.tenants
                .filter((t) =>
                  `${t.name} ${t.status} ${t.status === 'active' ? 'Ativa' : 'Suspensa'} ${t.subscription?.plan_key} ${snapshot.plans.find((p) => p.key === t.subscription?.plan_key)?.name || ''}`
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((t) => (
                  <button
                    className="tenant-card"
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                  >
                    <strong>{t.name}</strong>
                    <span>
                      {t.status === 'active' ? 'Ativa' : 'Suspensa'} ·{' '}
                      {t.subscription?.plan_key || 'Sem assinatura'}
                    </span>
                    <span>
                      {t.units.length} unidades ·{' '}
                      {t.connection?.capability_state || 'Pendente'}
                    </span>
                  </button>
                ))}
            </div>
            {tenant && (
              <>
                <h3>{tenant.name}</h3>
                <form
                  key={`${selected}-form-1`}
                  onSubmit={submit((f) =>
                    db.rpc('update_onboarding', {
                      tenant: tenant.id,
                      state: field(f, 'state'),
                      brand: field(f, 'brand'),
                      responsible: field(f, 'responsible'),
                      reason: field(f, 'reason')
                    })
                  )}
                >
                  <label htmlFor="company-stage">Etapa de onboarding</label>
                  <select
                    id="company-stage"
                    name="state"
                    defaultValue={tenant.configuration?.onboarding_state}
                  >
                    <option value="configuration">Configuração</option>
                    <option value="validation">Homologação</option>
                    <option value="pilot">Piloto</option>
                    <option value="active">Ativa</option>
                  </select>
                  <label htmlFor="company-brand">Marca</label>
                  <input
                    id="company-brand"
                    name="brand"
                    defaultValue={tenant.configuration?.brand}
                    required
                    maxLength={160}
                  />
                  <label htmlFor="company-owner">Responsável</label>
                  <input
                    id="company-owner"
                    name="responsible"
                    defaultValue={tenant.configuration?.responsible_name}
                    required
                  />
                  <label htmlFor="company-reason">
                    Evidência / motivo da etapa
                  </label>
                  <input
                    id="company-reason"
                    name="reason"
                    minLength={5}
                    required
                  />
                  <button disabled={busy}>Registrar etapa de onboarding</button>
                </form>
                <dl>
                  <dt>Marca e responsável</dt>
                  <dd>
                    {tenant.configuration?.brand} ·{' '}
                    {tenant.configuration?.responsible_name}
                  </dd>
                  <dt>Unidades</dt>
                  <dd>{tenant.units.map((u) => u.name).join(', ')}</dd>
                  <dt>Etapa e fuso</dt>
                  <dd>
                    {tenant.configuration?.onboarding_state} ·{' '}
                    {tenant.configuration?.timezone}
                  </dd>
                  <dt>Janela contratual de exportação</dt>
                  <dd>{date(tenant.configuration?.export_until)}</dd>
                </dl>
                <form
                  key={`${selected}-form-2`}
                  onSubmit={submit((f) =>
                    db.rpc('set_tenant_status', {
                      tenant: tenant.id,
                      suspended: tenant.status === 'active',
                      reason: field(f, 'reason'),
                      export_until: field(f, 'export')
                        ? new Date(field(f, 'export')).toISOString()
                        : undefined
                    })
                  )}
                >
                  <label htmlFor="status-reason">Motivo da transição</label>
                  <input
                    id="status-reason"
                    name="reason"
                    required
                    minLength={5}
                  />
                  <label htmlFor="export-window">
                    Exportação autorizável até (conforme contrato)
                  </label>
                  <input
                    id="export-window"
                    name="export"
                    type="datetime-local"
                  />
                  <button disabled={busy}>
                    {tenant.status === 'active'
                      ? 'Suspender empresa'
                      : 'Reativar empresa'}
                  </button>
                </form>
                <form
                  key={`${selected}-form-3`}
                  onSubmit={submit((f) =>
                    db.rpc('add_tenant_unit', {
                      tenant: tenant.id,
                      name: field(f, 'unit')
                    })
                  )}
                >
                  <label htmlFor="new-unit">
                    Nova unidade (sujeita à quota)
                  </label>
                  <input id="new-unit" name="unit" required maxLength={160} />
                  <button disabled={busy}>Adicionar unidade</button>
                </form>
              </>
            )}
          </>
        )}
        {tab === 'Onboarding' && (
          <>
            <h3>Provisionar empresa</h3>
            <p>
              A mesma referência retoma o cadastro sem duplicar empresa ou
              convite. O envio é uma ação separada.
            </p>
            <p className="muted">Referência: {request}</p>
            <form
              key={`${selected}-form-4`}
              onSubmit={submit(
                (f) =>
                  db.rpc('provision_tenant', {
                    request,
                    name: field(f, 'name'),
                    slug: field(f, 'slug'),
                    unit_name: field(f, 'unit'),
                    brand: field(f, 'brand'),
                    responsible: field(f, 'responsible'),
                    email: field(f, 'email'),
                    plan: field(f, 'plan'),
                    timezone: field(f, 'timezone')
                  }),
                'Empresa provisionada. Abra Conexões para enviar ou retomar o convite.'
              )}
            >
              {(
                [
                  ['name', 'Nome da empresa'],
                  ['slug', 'Slug'],
                  ['unit', 'Primeira unidade'],
                  ['brand', 'Marca'],
                  ['responsible', 'Responsável'],
                  ['email', 'E-mail do responsável'],
                  ['timezone', 'Fuso horário']
                ] as const
              ).map(([id, label]) => (
                <label key={id} htmlFor={`on-${id}`}>
                  {label}
                  <input
                    id={`on-${id}`}
                    name={id}
                    type={id === 'email' ? 'email' : 'text'}
                    defaultValue={id === 'timezone' ? 'America/Sao_Paulo' : ''}
                    required
                    maxLength={160}
                  />
                </label>
              ))}
              <label htmlFor="on-plan">Plano</label>
              <select id="on-plan" name="plan">
                {snapshot.plans.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="primary" disabled={busy}>
                Provisionar com esta referência
              </button>
            </form>
            <button
              disabled={busy}
              onClick={() => setRequest(crypto.randomUUID())}
            >
              Iniciar outro cadastro
            </button>
            <p>
              Checklist: cadastro → convite verificado → módulos revisados →
              conexão FLW homologada → ícone validado → aceite do piloto.
              Credenciais pendentes permitem concluir o cadastro.
            </p>
          </>
        )}
        {tab === 'Catálogo de módulos' && (
          <>
            <h3>Catálogo versionado</h3>
            <div className="cards">
              {snapshot.modules.map((m) => (
                <article className="tenant-card" key={m.key}>
                  <span className="chip">v{m.version}</span>
                  <h3>{m.name}</h3>
                  <p>{m.description}</p>
                  <p>Dependências: {m.dependencies.join(', ') || 'Nenhuma'}</p>
                  <code>{m.permission}</code>
                  <p>
                    {snapshot.plan_modules
                      .filter((p) => p.module_key === m.key)
                      .map((p) => p.plan_key)
                      .join(' · ')}
                  </p>
                </article>
              ))}
            </div>
            <p>
              Administradores da clínica testam uma configuração temporária e
              revisam antes de publicar. Um teste não concede novos direitos.
            </p>
            <h3>Override contratado</h3>
            <form
              key={`${selected}-form-5`}
              onSubmit={submit((f) =>
                db.rpc('set_module_override', {
                  tenant: field(f, 'tenant'),
                  module: field(f, 'module'),
                  enabled: field(f, 'enabled') === 'true',
                  until_at: new Date(field(f, 'until')).toISOString(),
                  reason: field(f, 'reason')
                })
              )}
            >
              <label htmlFor="override-tenant">Empresa</label>
              <select id="override-tenant" name="tenant" required>
                <option value="">Selecione</option>
                {snapshot.tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label htmlFor="override-module">Módulo</label>
              <select id="override-module" name="module">
                {snapshot.modules
                  .filter((m) => m.configurable)
                  .map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <label htmlFor="override-enabled">Direito</label>
              <select id="override-enabled" name="enabled">
                <option value="true">Conceder</option>
                <option value="false">Restringir</option>
              </select>
              <label htmlFor="override-until">Vigência até</label>
              <input
                id="override-until"
                name="until"
                type="datetime-local"
                required
              />
              <label htmlFor="override-reason">Motivo contratual</label>
              <input
                id="override-reason"
                name="reason"
                required
                minLength={5}
              />
              <button disabled={busy}>Registrar override</button>
            </form>
          </>
        )}
        {tab === 'Instalações de ícone' && tenant && (
          <>
            <h3>Gestão Estética na FLW</h3>
            <p>
              Configuração: {tenant.connection?.icon_state || 'pending'} · Aba
              externa proposta com Supabase Auth; comprovação FLW pendente.
            </p>
            <label htmlFor="launch-url">URL para instalação manual</label>
            <input
              id="launch-url"
              readOnly
              value={`${window.location.origin}${import.meta.env.BASE_URL}launch/${tenant.slug}`}
            />
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(
                    `${window.location.origin}${import.meta.env.BASE_URL}launch/${tenant.slug}`
                  )
                  .then(() => setNotice('URL copiada.'))
                  .catch(() =>
                    setNotice('Selecione a URL e copie manualmente.')
                  )
              }
            >
              Copiar URL
            </button>
            <p>
              Última configuração: {date(tenant.connection?.icon_updated_at)}.
              Instalador: {tenant.connection?.icon_installer || 'Pendente'}.
            </p>
            <form
              key={`${selected}-form-6`}
              onSubmit={submit((f) =>
                db.rpc('record_icon_installation', {
                  tenant: tenant.id,
                  account_label: field(f, 'account'),
                  icon_name: field(f, 'icon-name'),
                  desired_mode: field(f, 'mode'),
                  installation_status: field(f, 'installation-status'),
                  evidence: field(f, 'evidence'),
                  evolution: field(f, 'evolution')
                })
              )}
            >
              <label htmlFor="icon-account">
                Referência manual da conta (sem credenciais)
              </label>
              <input
                id="icon-account"
                name="account"
                required
                maxLength={120}
                defaultValue={tenant.connection?.icon_account_label}
              />
              <label htmlFor="icon-name">Nome do ícone</label>
              <input
                id="icon-name"
                name="icon-name"
                required
                maxLength={80}
                defaultValue={tenant.connection?.icon_name || 'Gestão Estética'}
              />
              <label htmlFor="icon-mode">
                Modo desejado (não habilita capacidade)
              </label>
              <select
                id="icon-mode"
                name="mode"
                defaultValue={tenant.connection?.desired_mode || 'external_tab'}
              >
                <option value="external_tab">Aba externa</option>
                <option value="same_tab">Mesma aba</option>
                <option value="iframe">Iframe — evolução condicionada</option>
                <option value="sso">SSO — evolução condicionada</option>
              </select>
              <label htmlFor="icon-status">Status da instalação manual</label>
              <select
                id="icon-status"
                name="installation-status"
                defaultValue={
                  tenant.connection?.installation_status || 'pending'
                }
              >
                <option value="pending">Pendente</option>
                <option value="installed">Instalado</option>
                <option value="tested">Testado</option>
                <option value="blocked">Bloqueado</option>
              </select>
              <label htmlFor="icon-evidence">
                Evidência redigida (sem tokens ou dados pessoais)
              </label>
              <textarea
                id="icon-evidence"
                name="evidence"
                maxLength={2000}
                defaultValue={tenant.connection?.installation_evidence}
              />
              <label htmlFor="icon-evolution">
                Evolução: referência de contrato oficial e prova formal
              </label>
              <textarea
                id="icon-evolution"
                name="evolution"
                maxLength={2000}
                defaultValue={tenant.connection?.evolution_evidence}
              />
              <button disabled={busy}>Registrar configuração manual</button>
            </form>
            <p>
              Validação humana pendente: conta FLW, ícone, abertura e retorno em
              desktop e celular. SSO e iframe não comprovados.
            </p>
          </>
        )}
        {tab === 'Conexões' && tenant && (
          <>
            <h3>Conexão FLW</h3>
            <dl>
              <dt>Credencial</dt>
              <dd>
                {tenant.connection?.credential_state === 'pending'
                  ? 'Pendente — implantar em modo manual'
                  : 'Referência no servidor'}
              </dd>
              <dt>Teste da conexão</dt>
              <dd>
                {tenant.connection?.test_state} ·{' '}
                {date(tenant.connection?.last_test_at)}
              </dd>
              <dt>Capacidade</dt>
              <dd>{tenant.connection?.capability_state}</dd>
              <dt>Evidência</dt>
              <dd>{tenant.connection?.evidence}</dd>
            </dl>
            <button
              disabled={busy}
              onClick={() =>
                void run(
                  () => db.rpc('test_connection', { tenant: tenant.id }),
                  'Teste bloqueado: obtenha credenciais e comprove a operação na homologação FLW.'
                )
              }
            >
              Testar conexão
            </button>
            <h3>Convites e retry</h3>
            {!tenant.invitations.length && <p>Nenhum convite registrado.</p>}
            {tenant.invitations.map((i) => (
              <article className="tenant-card" key={i.id}>
                <strong>{i.email}</strong>
                <p>
                  {i.accepted_at
                    ? 'Aceito'
                    : i.revoked_at
                      ? 'Revogado'
                      : `Envio: ${i.delivery}`}{' '}
                  · tentativas: {i.attempts} · expira: {date(i.expires_at)}
                </p>
                <p>{i.last_code}</p>
                <button
                  disabled={
                    busy ||
                    !!i.accepted_at ||
                    !!i.revoked_at ||
                    i.delivery === 'sent'
                  }
                  onClick={() =>
                    void run(async () => {
                      const queued = await db.rpc(
                        'request_invitation_delivery',
                        {
                          invitation: i.id
                        }
                      )
                      if (queued.error) return queued
                      const sent = await db.functions.invoke(
                        'invitation-delivery',
                        { body: { invitation: i.id } }
                      )
                      return {
                        error: sent.error
                          ? {
                              message:
                                'Pedido salvo. Envio indisponível: confira Edge Function, SMTP e tente novamente.'
                            }
                          : null
                      }
                    }, 'Auth aceitou o envio. Entrega na caixa de e-mail exige homologação SMTP.')
                  }
                >
                  Enviar / tentar novamente
                </button>
              </article>
            ))}
          </>
        )}
        {tab === 'Assinaturas SaaS' && tenant && (
          <>
            <h3>Assinatura da Zetta</h3>
            <p>
              Plano: {tenant.subscription?.plan_key} · Estado:{' '}
              {tenant.subscription?.state}. Cobrança registrada manualmente;
              nenhum provedor financeiro conectado.
            </p>
            <p>
              Vigência: {date(tenant.subscription?.valid_from)} até{' '}
              {tenant.subscription?.valid_until
                ? date(tenant.subscription.valid_until)
                : 'Sem término definido'}
              .
            </p>
            <p>
              Unidades: {tenant.units.length} /{' '}
              {tenant.subscription?.unit_limit_override ||
                snapshot.plans.find(
                  (p) => p.key === tenant.subscription?.plan_key
                )?.unit_limit}
            </p>
            <form
              key={`${selected}-form-7`}
              onSubmit={submit((f) =>
                db.rpc('set_tenant_plan', {
                  tenant: tenant.id,
                  plan: field(f, 'plan'),
                  reason: field(f, 'reason'),
                  valid_until: field(f, 'until')
                    ? new Date(field(f, 'until')).toISOString()
                    : undefined
                })
              )}
            >
              <label htmlFor="saas-plan">Plano contratado</label>
              <select
                id="saas-plan"
                name="plan"
                defaultValue={tenant.subscription?.plan_key}
              >
                {snapshot.plans.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} ·{' '}
                    {(p.monthly_cents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    })}{' '}
                    / mês · {p.unit_limit} unidades
                  </option>
                ))}
              </select>
              <label htmlFor="saas-until">Vigência até (opcional)</label>
              <input id="saas-until" name="until" type="datetime-local" />
              <label htmlFor="saas-reason">Motivo da mudança de plano</label>
              <input id="saas-reason" name="reason" required minLength={5} />
              <button disabled={busy}>Aplicar plano e direitos padrão</button>
            </form>
            <form
              key={`${selected}-form-8`}
              onSubmit={submit((f) =>
                db.rpc('update_subscription', {
                  tenant: tenant.id,
                  state: field(f, 'state'),
                  unit_limit: field(f, 'limit')
                    ? Number(field(f, 'limit'))
                    : undefined,
                  reason: field(f, 'reason')
                })
              )}
            >
              <label htmlFor="subscription-state">Situação da assinatura</label>
              <select
                id="subscription-state"
                name="state"
                defaultValue={tenant.subscription?.state}
              >
                <option value="trial">Trial</option>
                <option value="active">Ativa</option>
                <option value="grace">Carência</option>
                <option value="cancelled">Cancelada</option>
              </select>
              <label htmlFor="subscription-limit">
                Limite contratado de unidades (vazio usa plano)
              </label>
              <input
                id="subscription-limit"
                name="limit"
                type="number"
                min={1}
                max={1000}
                defaultValue={tenant.subscription?.unit_limit_override || ''}
              />
              <label htmlFor="subscription-reason">Motivo contratual</label>
              <input
                id="subscription-reason"
                name="reason"
                minLength={5}
                required
              />
              <button disabled={busy}>Registrar situação e limite</button>
            </form>
            <h3>Entitlements</h3>
            {tenant.entitlements.map((e) => (
              <p key={e.module_key}>
                {e.module_key} ·{' '}
                {e.enabled && e.configured ? 'Habilitado' : 'Desabilitado'} ·{' '}
                {e.source} · até{' '}
                {e.valid_until ? date(e.valid_until) : 'Sem término'}
              </p>
            ))}
          </>
        )}
        {tab === 'Suporte' && tenant && (
          <>
            <h3>Concessão temporária</h3>
            <p>
              Diagnósticos contêm somente estados e contagens. Não incluem
              conteúdo clínico, credenciais ou mensagens de provedores.
              Exportação exige janela contratual e admin destinatário.
            </p>
            <form
              key={`${selected}-form-9`}
              onSubmit={submit((f) =>
                db.rpc('grant_support', {
                  tenant: tenant.id,
                  grantee: field(f, 'grantee'),
                  scope: field(f, 'scope'),
                  minutes: Number(field(f, 'minutes')),
                  reason: field(f, 'reason')
                })
              )}
            >
              <label htmlFor="support-user">UUID do destinatário</label>
              <input id="support-user" name="grantee" required />
              <label htmlFor="support-scope">Escopo</label>
              <select id="support-scope" name="scope">
                <option value="diagnostics">Diagnósticos redigidos</option>
                <option value="export">
                  Exportação de metadados autorizados
                </option>
              </select>
              <label htmlFor="support-minutes">Duração em minutos</label>
              <input
                id="support-minutes"
                name="minutes"
                type="number"
                min={1}
                max={60}
                defaultValue={15}
                required
              />
              <label htmlFor="support-reason">
                Motivo e referência da autorização
              </label>
              <input id="support-reason" name="reason" minLength={5} required />
              <button disabled={busy}>Conceder acesso temporário</button>
            </form>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await db.rpc('support_diagnostics', {
                    tenant: tenant.id
                  })
                  if (!r.error) setDiagnostic(r.data)
                  return r
                })
              }
            >
              Consultar diagnóstico com minha concessão
            </button>
            {diagnostic && <pre>{JSON.stringify(diagnostic, null, 2)}</pre>}
            {snapshot.support
              .filter((g) => g.tenant_id === tenant.id)
              .map((g) => (
                <article className="tenant-card" key={g.id}>
                  <p>
                    {g.scope} · destinatário {g.grantee} · aprovador{' '}
                    {g.approver}
                  </p>
                  <p>
                    {g.reason} · expira {date(g.expires_at)} ·{' '}
                    {g.revoked_at
                      ? 'Revogado'
                      : new Date(g.expires_at).getTime() > Date.now()
                        ? 'Vigente'
                        : 'Expirado'}
                  </p>
                  <button
                    disabled={busy || !!g.revoked_at}
                    onClick={() =>
                      void run(() =>
                        db.rpc('revoke_support', { grant_id: g.id })
                      )
                    }
                  >
                    Revogar concessão
                  </button>
                </article>
              ))}
            <h3>Mudança de escopo</h3>
            <form
              key={`${selected}-form-10`}
              onSubmit={submit((f) =>
                db.rpc('set_member_scope', {
                  tenant: tenant.id,
                  membership: field(f, 'membership'),
                  units: field(f, 'units')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                  reason: field(f, 'reason')
                })
              )}
            >
              <label htmlFor="scope-member">UUID do vínculo</label>
              <input id="scope-member" name="membership" required />
              <label htmlFor="scope-units">
                UUIDs das unidades, separados por vírgula
              </label>
              <input id="scope-units" name="units" required />
              <label htmlFor="scope-reason">Motivo da mudança de escopo</label>
              <input id="scope-reason" name="reason" minLength={5} required />
              <button disabled={busy}>Revisar escopo do vínculo</button>
            </form>
          </>
        )}
        {tenant && tab !== 'Onboarding' && tab !== 'Catálogo de módulos' && (
          <details>
            <summary>Trilha recente da empresa</summary>
            {snapshot.audit.filter((a) => a.tenant_id === tenant.id).length ===
            0 ? (
              <p>Sem eventos recentes.</p>
            ) : (
              snapshot.audit
                .filter((a) => a.tenant_id === tenant.id)
                .map((a) => (
                  <p key={a.id}>
                    {date(a.created_at)} · {a.action} · {a.entity} · ator{' '}
                    {a.actor_id || 'Sistema'}{' '}
                    <code>{JSON.stringify(a.details)}</code>
                  </p>
                ))
            )}
          </details>
        )}
      </div>
      <p>
        <Link to="/">Voltar</Link>
      </p>
    </section>
  )
}

export function ClinicModules({
  db,
  tenant,
  unit,
  admin,
  selectedModule
}: {
  db: DB
  tenant: string
  unit: string
  admin: boolean
  selectedModule?: string
}) {
  const { slug } = useParams()
  const [modules, setModules] = useState<
    | (Row<'module_catalog'> & {
        allowed: boolean
        canConfigure: boolean
        entitlement?: Row<'tenant_entitlements'>
      })[]
    | null
  >(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{
    id: string
    module: string
    enabled: boolean
    canPublish: boolean
  } | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let live = true
    setModules(null)
    setError('')
    setPreview(null)
    if (!unit) {
      setModules([])
      return
    }
    ;(async () => {
      const [catalog, rights] = await Promise.all([
        db.from('module_catalog').select('*'),
        db.from('tenant_entitlements').select('*').eq('tenant_id', tenant)
      ])
      if (catalog.error || rights.error)
        throw new Error('Falha ao carregar módulos.')
      const rows = await Promise.all(
        catalog.data
          .filter((m) => m.key !== 'core')
          .map(async (m) => {
            const check = await db.rpc('check_access', {
              tenant,
              unit,
              permission: m.permission,
              module: m.key
            })
            if (check.error) throw check.error
            const configure = await db.rpc('check_access', {
              tenant,
              unit,
              permission: 'modules.configure',
              module: 'core'
            })
            if (configure.error) throw configure.error
            return {
              ...m,
              canConfigure: configure.data,
              allowed: check.data,
              entitlement: rights.data.find((e) => e.module_key === m.key)
            }
          })
      )
      if (live) setModules(rows)
    })().catch(() => {
      if (live)
        setError(
          'Falha ao verificar módulos. Recarregue para tentar novamente.'
        )
    })
    return () => {
      live = false
    }
  }, [db, tenant, unit, revision])
  useEffect(() => {
    setMessage('')
    setPreview(null)
  }, [tenant, unit, selectedModule])
  async function test(module: string) {
    setBusy(true)
    try {
      const r = await db.rpc('module_probe', { tenant, unit, module })
      setMessage(r.error ? 'Acesso ao módulo negado pelo banco.' : r.data)
    } catch {
      setMessage('Falha no teste. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }
  const current = modules?.find((m) => m.key === selectedModule)
  if (error) return <p role="alert">{error}</p>
  if (!modules) return <p role="status">Verificando módulos…</p>
  if (selectedModule)
    return (
      <article>
        <h3>{current?.name || 'Módulo desconhecido'}</h3>
        {!current?.allowed ? (
          <p role="alert">
            Módulo não autorizado para este vínculo, unidade ou contrato.
          </p>
        ) : (
          <>
            <p>{current.description}</p>
            <button disabled={busy} onClick={() => void test(current.key)}>
              Testar RPC protegida
            </button>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </article>
    )
  return (
    <>
      <h3>Módulos da clínica</h3>
      <div className="cards">
        {modules.map((m) => (
          <article className="tenant-card" key={m.key}>
            <h4>{m.name}</h4>
            <p>
              {m.allowed
                ? 'Autorizado'
                : 'Indisponível neste escopo ou contrato'}
            </p>
            {m.allowed && (
              <Link to={`/clinicas/${slug}/modulos/${m.key}`}>
                Abrir {m.name}
              </Link>
            )}
            {admin &&
              m.canConfigure &&
              m.entitlement?.enabled &&
              new Date(m.entitlement.valid_from).getTime() <= Date.now() &&
              (!m.entitlement.valid_until ||
                new Date(m.entitlement.valid_until).getTime() > Date.now()) && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    setMessage('')
                    setPreview(null)
                    try {
                      const enabled = !m.entitlement!.configured
                      const r = await db.rpc('preview_module', {
                        tenant,
                        module: m.key,
                        enabled
                      })
                      if (r.error) setMessage(r.error.message)
                      else {
                        const tested = await db.rpc('test_module_change', {
                          change: r.data,
                          unit
                        })
                        if (tested.error) setMessage(tested.error.message)
                        else
                          setPreview({
                            id: r.data,
                            module: m.key,
                            enabled,
                            canPublish: !!(
                              tested.data as { can_publish?: boolean }
                            )?.can_publish
                          })
                      }
                    } catch {
                      setMessage('Falha ao preparar revisão.')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Testar configuração de {m.name}
                </button>
              )}
          </article>
        ))}
      </div>
      {preview && (
        <article className="tenant-card">
          <h4>Revisão antes de publicar</h4>
          <p>
            {preview.enabled ? 'Habilitar' : 'Desabilitar'} {preview.module}.
            Prévia de 15 minutos, sem alterar acesso operacional. Teste
            temporário:{' '}
            {preview.canPublish
              ? 'configuração válida'
              : 'bloqueada por dependência ou contrato'}
            . As regras serão revalidadas na publicação.
          </p>
          <button
            disabled={busy || !preview.canPublish}
            onClick={async () => {
              setBusy(true)
              try {
                const r = await db.rpc('publish_module', {
                  change: preview.id
                })
                if (r.error) setMessage(r.error.message)
                else {
                  setMessage('Configuração publicada. Acesso atualizado.')
                  setRevision((v) => v + 1)
                  setPreview(null)
                }
              } catch {
                setMessage('Falha ao publicar. Tente novamente.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Publicar configuração revisada
          </button>
          <button onClick={() => setPreview(null)}>Descartar prévia</button>
        </article>
      )}
      {message && <p role="status">{message}</p>}
    </>
  )
}
