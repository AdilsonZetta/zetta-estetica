import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addLocalMinutes } from './catalog-time'
import type { Database, Json } from './database.types'

type ResourceUnit = { unit_id: string; location: string; capacity: number }
type Resource = {
  id: string
  name: string
  kind: string
  qualification: string
  membership_id: string | null
  capabilities: string[]
  active: boolean
  eligible?: boolean
  version: number
  units: ResourceUnit[]
  can_edit: boolean
}
type Requirement = { kind: string; capability: string; quantity: number }
type ServiceLink = {
  resource_id: string
  unit_id: string
  name?: string
  kind?: string
  active?: boolean
  eligible?: boolean
}
type Service = {
  id: string
  version_id: string
  name: string
  version: number
  category: string
  duration_minutes: number
  buffer_before: number
  buffer_after: number
  price_cents: number
  currency: string
  preparation: string
  state: string
  units: string[]
  resources: ServiceLink[]
  requirements: Requirement[]
  can_edit: boolean
}
type Window = {
  id: string
  resource_id: string
  name: string
  kind: string
  local_start: string
  local_end: string
  timezone: string
  reason: string
}
type Free = {
  id: string
  name: string
  kind: string
  available: boolean
  location: string
  capacity: number
}
const kinds: Record<string, string> = {
  professional: 'Profissional',
  room: 'Sala',
  equipment: 'Equipamento',
  shift: 'Turno',
  off: 'Folga',
  holiday: 'Feriado',
  exception: 'Exceção de abertura',
}
const emptyService = (unit: string): Service => ({
  id: '',
  version_id: '',
  name: '',
  version: 0,
  category: 'Avaliação',
  duration_minutes: 30,
  buffer_before: 5,
  buffer_after: 5,
  price_cents: 15000,
  currency: 'BRL',
  preparation: '',
  state: 'published',
  units: [unit],
  resources: [],
  requirements: [],
  can_edit: true,
})
const emptyResource = (unit: string): Resource => ({
  id: '',
  name: '',
  kind: 'professional',
  qualification: '',
  membership_id: null,
  capabilities: [],
  active: true,
  version: 0,
  units: [{ unit_id: unit, location: 'Unidade', capacity: 1 }],
  can_edit: true,
})
const money = (cents: number, currency: string) => {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  } catch {
    return `${cents} centavos · ${currency}`
  }
}
export function ClinicCatalog({
  db,
  tenant,
  unit,
  units,
}: {
  db: SupabaseClient<Database>
  tenant: string
  unit: string
  units: { id: string; name: string; timezone?: string }[]
}) {
  const [tab, setTab] = useState('services'),
    [rows, setRows] = useState<(Service | Resource | Window)[]>([]),
    [resources, setResources] = useState<Resource[]>([])
  const [service, setService] = useState(emptyService(unit)),
    [resource, setResource] = useState(emptyResource(unit))
  const [history, setHistory] = useState<Service[]>([]),
    [free, setFree] = useState<Free[] | null>(null)
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [epoch, setEpoch] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [write, setWrite] = useState(false),
    [hasMore, setHasMore] = useState(false)
  const [windowResource, setWindowResource] = useState(''),
    [windowKind, setWindowKind] = useState('shift'),
    [windowId, setWindowId] = useState<string | null>(null)
  const [start, setStart] = useState('2026-11-16T09:00'),
    [end, setEnd] = useState('2026-11-16T10:00'),
    [reason, setReason] = useState('')
  const [timezone, setTimezone] = useState(
    units.find((u) => u.id === unit)?.timezone || 'America/Sao_Paulo',
  )
  const [selectedVersion, setSelectedVersion] = useState(''),
    [serviceOptions, setServiceOptions] = useState<Service[]>([]),
    [teamOptions, setTeamOptions] = useState<{ id: string; name: string }[]>([])
  const [historyBusy, setHistoryBusy] = useState(false)
  const historyRequest = useRef(0)
  const historyBusyRef = useRef(false)
  const fail = (code?: string) =>
    setError(
      code === '40001'
        ? 'Configuração alterada por outra pessoa. Recarregue antes de salvar.'
        : code === '23P01'
          ? 'Conflito de jornada: este recurso já atua nesse intervalo, inclusive em outra unidade.'
          : `Operação recusada (${code || 'rede'}). Confira escopo, campos e vínculos históricos.`,
    )
  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    async function loadServices() {
      const all: Service[] = []
      let after: string | undefined
      for (;;) {
        const r = await db.rpc('list_catalog', {
          tenant,
          unit,
          kind: 'services',
          after_id: after,
        })
        if (r.error) throw r.error
        const page = r.data as unknown as Service[]
        all.push(...page)
        if (page.length < 30) return all
        after = page.at(-1)!.id
      }
    }
    const accessCall = db.rpc('check_access', {
      tenant,
      unit,
      permission: 'catalog.write',
    })
    void Promise.all([
      db.rpc('list_catalog', { tenant, unit, kind: tab, query: search }),
      accessCall,
      // Seletores carregam o catálogo de recursos em páginas, sem truncar profissionais.
      (async () => {
        const all: Resource[] = []
        let after: string | undefined
        for (;;) {
          const r = await db.rpc('list_catalog', {
            tenant,
            unit,
            kind: 'resources',
            after_id: after,
          })
          if (r.error) throw r.error
          const page = r.data as unknown as Resource[]
          all.push(...page)
          if (page.length < 30) return all
          after = page.at(-1)!.id
        }
      })(),
      loadServices(),
      (async () => {
        if (tab !== 'resources')
          return { data: [] as { id: string; name: string }[], error: null }
        const access = await accessCall
        if (access.data !== true)
          return { data: [] as { id: string; name: string }[], error: null }
        const team = await db.rpc('catalog_team_options', { tenant, unit })
        return team.error
          ? {
              data: [] as { id: string; name: string }[],
              error: { code: team.error.code },
            }
          : {
              data: team.data as unknown as { id: string; name: string }[],
              error: null,
            }
      })(),
      db
        .from('units')
        .select('timezone')
        .eq('tenant_id', tenant)
        .eq('id', unit)
        .single(),
    ])
      .then(([r, access, all, services, team, currentUnit]) => {
        if (!live) return
        if (r.error || access.error || currentUnit.error) {
          fail(r.error?.code || access.error?.code || currentUnit.error?.code)
          setRows([])
        } else {
          const data = r.data as unknown as (Service | Resource | Window)[]
          setRows(data)
          setHasMore(data.length === 30)
          setWrite(access.data === true)
          setTimezone(currentUnit.data!.timezone)
          setResources(all)
          setServiceOptions(services)
          setSelectedVersion((current) =>
            services.some(
              (s) => s.version_id === current && s.state === 'published',
            )
              ? current
              : '',
          )
          setTeamOptions(
            team.error
              ? []
              : (team.data as unknown as { id: string; name: string }[]),
          )
        }
      })
      .catch(() => {
        if (live) fail()
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [db, tenant, unit, tab, search, epoch])
  async function act(
    work: () => PromiseLike<{ error: { code?: string } | null }>,
    success: string,
  ) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const r = await work()
      if (r.error) {
        fail(r.error.code)
        return false
      }
      setMessage(success)
      setEpoch((e) => e + 1)
      setFree(null)
      return true
    } catch {
      fail()
      return false
    } finally {
      setBusy(false)
    }
  }
  async function more() {
    setBusy(true)
    try {
      const r = await db.rpc('list_catalog', {
        tenant,
        unit,
        kind: tab,
        query: search,
        after_id: rows.at(-1)?.id,
      })
      if (r.error) fail(r.error.code)
      else {
        const next = r.data as unknown as typeof rows
        setRows([...rows, ...next])
        setHasMore(next.length === 30)
      }
    } finally {
      setBusy(false)
    }
  }
  async function versions(s: Service, more = false) {
    if (more && historyBusyRef.current) return
    const request = ++historyRequest.current
    historyBusyRef.current = true
    setHistoryBusy(true)
    setService(s)
    setError('')
    if (!more) setHistory([])
    try {
      const r = await db.rpc('catalog_service_history', {
        tenant,
        unit,
        service: s.id,
        after_version: more ? history.at(-1)?.version : undefined,
      })
      if (request !== historyRequest.current) return
      if (r.error) fail(r.error.code)
      else
        setHistory(
          more
            ? [...history, ...(r.data as unknown as Service[])]
            : (r.data as unknown as Service[]),
        )
    } finally {
      if (request === historyRequest.current) {
        historyBusyRef.current = false
        setHistoryBusy(false)
      }
    }
  }
  function applyDuration(nextStart: string, versionId = selectedVersion) {
    const version = serviceOptions.find((s) => s.version_id === versionId)
    if (!version) return
    const computed = addLocalMinutes(
      nextStart,
      version.duration_minutes,
      timezone,
    )
    if (computed) setEnd(computed)
  }
  const checkUnit = (id: string, checked: boolean) =>
    setService({
      ...service,
      units: checked
        ? [...service.units, id]
        : service.units.filter((u) => u !== id),
      resources: checked
        ? service.resources
        : service.resources.filter((r) => r.unit_id !== id),
    })
  const numberField = (
    key: 'duration_minutes' | 'buffer_before' | 'buffer_after' | 'price_cents',
    label: string,
    min: number,
    max: number,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step="1"
        required
        value={service[key]}
        onChange={(e) =>
          setService({ ...service, [key]: Number(e.target.value) })
        }
      />
    </label>
  )
  return (
    <section aria-label="Catálogo operacional" className="catalog">
      <p className="eyebrow">CONFIGURAÇÃO DA CLÍNICA</p>
      <h2>Serviços, profissionais e recursos</h2>
      <p>
        A habilitação operacional não concede acesso ao aplicativo. Permissões
        são administradas em Equipe.
      </p>
      <nav className="catalog-tabs" aria-label="Áreas do catálogo">
        {[
          ['services', 'Serviços'],
          ['resources', 'Profissionais e recursos'],
          ['windows', 'Jornadas e disponibilidade'],
        ].map(([id, title]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setRows([])
              setLoading(true)
              setTab(id)
              setSearch('')
              setQuery('')
              setMessage('')
              setError('')
              setWindowId(null)
            }}
          >
            {title}
          </button>
        ))}
      </nav>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <form
        className="catalog-search"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(query)
          setEpoch((v) => v + 1)
        }}
      >
        <label>
          Pesquisar catálogo
          <input
            value={query}
            maxLength={160}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button disabled={busy}>Pesquisar</button>
      </form>
      {loading ? (
        <p role="status">Carregando catálogo…</p>
      ) : (
        <>
          <ul className="client-list">
            {rows.map((row) => (
              <li key={row.id}>
                {tab === 'services' ? (
                  <>
                    <strong>{row.name}</strong>
                    <span>
                      {' '}
                      v{(row as Service).version} ·{' '}
                      {(row as Service).state === 'published'
                        ? 'Publicado'
                        : 'Inativo'}{' '}
                      ·{' '}
                      {money(
                        (row as Service).price_cents,
                        (row as Service).currency,
                      )}
                    </span>
                    <button
                      onClick={() => {
                        setMessage('')
                        void versions(row as Service)
                      }}
                    >
                      Ver serviço {row.name}
                    </button>
                  </>
                ) : tab === 'resources' ? (
                  <>
                    <strong>{row.name}</strong>
                    <span>
                      {kinds[(row as Resource).kind]} ·{' '}
                      {(row as Resource).active ? 'Ativo' : 'Inativo'}
                    </span>
                    <button
                      onClick={() => {
                        setResource(row as Resource)
                        setError('')
                        setMessage('')
                      }}
                    >
                      Configurar {row.name}
                    </button>
                  </>
                ) : (
                  <>
                    <strong>
                      {row.name} · {kinds[(row as Window).kind]}
                    </strong>
                    <span>
                      {(row as Window).local_start.replace('T', ' ')} até{' '}
                      {(row as Window).local_end.replace('T', ' ')} ·{' '}
                      {(row as Window).timezone} · {(row as Window).reason}
                    </span>
                    {write && (
                      <>
                        <button
                          onClick={() => {
                            const w = row as Window
                            setWindowId(w.id)
                            setWindowResource(w.resource_id)
                            setWindowKind(w.kind)
                            setStart(w.local_start.slice(0, 16))
                            setEnd(w.local_end.slice(0, 16))
                            setReason(w.reason)
                          }}
                        >
                          Editar janela de {row.name}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            const id = row.id
                            void act(
                              () =>
                                db.rpc('delete_catalog_window', {
                                  tenant,
                                  unit,
                                  window_id: id,
                                }),
                              'Janela removida com auditoria.',
                            ).then((ok) => {
                              if (ok)
                                setWindowId((current) =>
                                  current === id ? null : current,
                                )
                            })
                          }}
                        >
                          Remover janela de {row.name}
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {!rows.length && <p>Nenhum registro encontrado.</p>}
          {hasMore && (
            <button disabled={busy} onClick={() => void more()}>
              Carregar mais
            </button>
          )}
        </>
      )}
      {tab === 'services' && (
        <div className="catalog-grid">
          <form
            className="glass"
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                await act(
                  () =>
                    db.rpc('publish_catalog_service', {
                      tenant,
                      unit,
                      service: service.id || undefined,
                      expected_version: service.version || undefined,
                      payload: service as unknown as Json,
                    }),
                  'Versão publicada. O histórico foi preservado.',
                )
              ) {
                setService(emptyService(unit))
                setHistory([])
              }
            }}
          >
            <h3>
              {service.id
                ? `Nova versão de ${service.name}`
                : 'Criar e publicar serviço'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setService(emptyService(unit))
                setHistory([])
                setError('')
                setMessage('')
              }}
            >
              Novo serviço
            </button>
            <fieldset disabled={!write || busy || loading || !service.can_edit}>
              <label>
                Nome do serviço
                <input
                  required
                  maxLength={160}
                  value={service.name}
                  onChange={(e) =>
                    setService({ ...service, name: e.target.value })
                  }
                />
              </label>
              <label>
                Categoria
                <input
                  required
                  maxLength={100}
                  value={service.category}
                  onChange={(e) =>
                    setService({ ...service, category: e.target.value })
                  }
                />
              </label>
              <div className="catalog-grid">
                {numberField('duration_minutes', 'Duração em minutos', 1, 1440)}
                {numberField('buffer_before', 'Buffer antes (min)', 0, 1440)}
                {numberField('buffer_after', 'Buffer depois (min)', 0, 1440)}
                {numberField(
                  'price_cents',
                  'Preço em centavos',
                  0,
                  999999999999,
                )}
              </div>
              <label>
                Moeda ISO
                <input
                  required
                  pattern="[A-Z]{3}"
                  maxLength={3}
                  value={service.currency}
                  onChange={(e) =>
                    setService({
                      ...service,
                      currency: e.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label>
                Preparo administrativo
                <textarea
                  maxLength={2000}
                  value={service.preparation}
                  onChange={(e) =>
                    setService({ ...service, preparation: e.target.value })
                  }
                />
              </label>
              <label>
                Estado do serviço
                <select
                  value={service.state}
                  onChange={(e) =>
                    setService({ ...service, state: e.target.value })
                  }
                >
                  <option value="published">Publicado</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              <fieldset>
                <legend>Unidades disponíveis</legend>
                {units.map((u) => (
                  <label key={u.id} className="check">
                    <input
                      type="checkbox"
                      disabled={u.id === unit}
                      checked={service.units.includes(u.id)}
                      onChange={(e) => checkUnit(u.id, e.target.checked)}
                    />
                    {u.name}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>
                  Profissionais habilitados e recursos nominados nesta unidade
                </legend>
                {resources
                  .filter(
                    (r) =>
                      (r.eligible !== false && r.active) ||
                      service.resources.some(
                        (x) => x.unit_id === unit && x.resource_id === r.id,
                      ),
                  )
                  .map((r) => (
                    <label key={r.id} className="check">
                      <input
                        type="checkbox"
                        checked={service.resources.some(
                          (x) => x.unit_id === unit && x.resource_id === r.id,
                        )}
                        onChange={(e) =>
                          setService({
                            ...service,
                            resources: e.target.checked
                              ? [
                                  ...service.resources,
                                  { unit_id: unit, resource_id: r.id },
                                ]
                              : service.resources.filter(
                                  (x) =>
                                    x.unit_id !== unit ||
                                    x.resource_id !== r.id,
                                ),
                          })
                        }
                      />
                      {kinds[r.kind]} · {r.name}
                      {(!r.active || r.eligible === false) &&
                        ' · Habilitação indisponível — remova da nova versão'}
                    </label>
                  ))}
                {!resources.length && (
                  <p>Cadastre profissionais e recursos para habilitá-los.</p>
                )}
              </fieldset>
              {service.resources.some((x) => x.unit_id !== unit) && (
                <fieldset>
                  <legend>Vínculos nominados em outras unidades</legend>
                  <p>
                    A publicação exige habilitação vigente em cada unidade.
                    Remova o vínculo que a nova versão não puder manter.
                  </p>
                  {service.resources
                    .filter((x) => x.unit_id !== unit)
                    .map((x) => (
                      <label
                        key={`${x.unit_id}:${x.resource_id}`}
                        className="check"
                      >
                        <input
                          type="checkbox"
                          checked
                          onChange={() =>
                            setService({
                              ...service,
                              resources: service.resources.filter(
                                (item) =>
                                  item.unit_id !== x.unit_id ||
                                  item.resource_id !== x.resource_id,
                              ),
                            })
                          }
                        />
                        {kinds[x.kind || ''] || 'Recurso'} ·{' '}
                        {x.name || 'Recurso de outra unidade'} ·{' '}
                        {units.find((u) => u.id === x.unit_id)?.name ||
                          'Outra unidade'}
                        {(x.active === false || x.eligible === false) &&
                          ' · Habilitação indisponível — remova da nova versão'}
                      </label>
                    ))}
                </fieldset>
              )}
              <fieldset>
                <legend>Exigências de sala e equipamento</legend>
                {service.requirements.map((q, i) => (
                  <div key={i} className="catalog-grid">
                    <label>
                      Tipo exigido
                      <select
                        value={q.kind}
                        onChange={(e) =>
                          setService({
                            ...service,
                            requirements: service.requirements.map((x, n) =>
                              n === i ? { ...x, kind: e.target.value } : x,
                            ),
                          })
                        }
                      >
                        <option value="room">Sala</option>
                        <option value="equipment">Equipamento</option>
                      </select>
                    </label>
                    <label>
                      Capacidade exigida
                      <input
                        required
                        maxLength={100}
                        value={q.capability}
                        onChange={(e) =>
                          setService({
                            ...service,
                            requirements: service.requirements.map((x, n) =>
                              n === i
                                ? { ...x, capability: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Quantidade mínima
                      <input
                        required
                        type="number"
                        min="1"
                        max="1000"
                        value={q.quantity}
                        onChange={(e) =>
                          setService({
                            ...service,
                            requirements: service.requirements.map((x, n) =>
                              n === i
                                ? { ...x, quantity: Number(e.target.value) }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setService({
                          ...service,
                          requirements: service.requirements.filter(
                            (_, n) => n !== i,
                          ),
                        })
                      }
                    >
                      Remover exigência
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setService({
                      ...service,
                      requirements: [
                        ...service.requirements,
                        { kind: 'room', capability: '', quantity: 1 },
                      ],
                    })
                  }
                >
                  Adicionar exigência
                </button>
              </fieldset>
              <p className="catalog-preview">
                Prévia v{service.version + 1} ·{' '}
                {money(service.price_cents, service.currency)} ·{' '}
                {service.duration_minutes} min + {service.buffer_before} antes +{' '}
                {service.buffer_after} depois ={' '}
                {service.duration_minutes +
                  service.buffer_before +
                  service.buffer_after}{' '}
                min de ocupação.
              </p>
              <button className="primary">Publicar versão</button>
            </fieldset>
            {!service.can_edit && (
              <p>Editar exige escopo de todas as unidades deste serviço.</p>
            )}
          </form>
          <aside className="glass">
            <h3>Histórico e profissionais elegíveis</h3>
            <p>
              Selecione um serviço para revisar as versões. Inativar publica uma
              nova versão; referências anteriores continuam legíveis.
            </p>
            {service.resources
              .filter((x) => x.unit_id === unit)
              .map((x) => (
                <p key={x.resource_id}>
                  {resources.find((r) => r.id === x.resource_id)?.name ||
                    'Recurso cadastrado'}{' '}
                  ·{' '}
                  {resources.find((r) => r.id === x.resource_id)?.eligible
                    ? 'Habilitação vigente'
                    : 'Revisar habilitação'}
                </p>
              ))}
            {history.map((v) => (
              <p key={v.id}>
                v{v.version} ·{' '}
                {v.state === 'inactive' ? 'Inativo' : 'Publicado'} ·{' '}
                {money(v.price_cents, v.currency)} · {v.duration_minutes} min ·
                buffers {v.buffer_before}/{v.buffer_after} · {v.preparation}
              </p>
            ))}
            {history.length > 0 && history.length % 30 === 0 && (
              <button
                disabled={historyBusy}
                onClick={() => void versions(service, true)}
              >
                Mais versões
              </button>
            )}
          </aside>
        </div>
      )}
      {tab === 'resources' && (
        <form
          className="glass"
          onSubmit={async (e) => {
            e.preventDefault()
            if (
              await act(
                () =>
                  db.rpc('save_catalog_resource', {
                    tenant,
                    unit,
                    resource: resource.id || undefined,
                    expected_version: resource.version || undefined,
                    payload: resource as unknown as Json,
                  }),
                'Recurso salvo com identidade única na clínica.',
              )
            )
              setResource(emptyResource(unit))
          }}
        >
          <h3>Cadastro operacional</h3>
          <button
            type="button"
            onClick={() => {
              setResource(emptyResource(unit))
              setError('')
              setMessage('')
            }}
          >
            Novo recurso
          </button>
          <fieldset disabled={!write || busy || loading || !resource.can_edit}>
            <label>
              Tipo de recurso
              <select
                disabled={!!resource.id}
                value={resource.kind}
                onChange={(e) =>
                  setResource({
                    ...resource,
                    kind: e.target.value,
                    membership_id: null,
                  })
                }
              >
                {['professional', 'room', 'equipment'].map((k) => (
                  <option value={k} key={k}>
                    {kinds[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nome do recurso
              <input
                required
                maxLength={160}
                value={resource.name}
                onChange={(e) =>
                  setResource({ ...resource, name: e.target.value })
                }
              />
            </label>
            {resource.kind === 'professional' && (
              <>
                <label>
                  Vínculo opcional à equipe
                  <select
                    value={resource.membership_id || ''}
                    onChange={(e) =>
                      setResource({
                        ...resource,
                        membership_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Sem vínculo de acesso</option>
                    {resource.membership_id &&
                      !teamOptions.some(
                        (m) => m.id === resource.membership_id,
                      ) && (
                        <option value={resource.membership_id}>
                          Vínculo indisponível/revogado — remova ou substitua
                        </option>
                      )}
                    {teamOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  O vínculo deve estar ativo e atribuído a todas as unidades de
                  atuação.
                </p>
                <label>
                  Qualificação operacional
                  <textarea
                    maxLength={1000}
                    value={resource.qualification}
                    onChange={(e) =>
                      setResource({
                        ...resource,
                        qualification: e.target.value,
                      })
                    }
                  />
                </label>
              </>
            )}
            <label>
              Capacidades (separadas por vírgula)
              <input
                value={resource.capabilities.join(',')}
                onChange={(e) =>
                  setResource({
                    ...resource,
                    capabilities: e.target.value.split(','),
                  })
                }
                placeholder="avaliacao,maca"
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={resource.active}
                onChange={(e) =>
                  setResource({ ...resource, active: e.target.checked })
                }
              />
              Recurso ativo
            </label>
            <fieldset>
              <legend>Unidades de atuação e localização</legend>
              {units.map((u) => {
                const ru = resource.units.find((x) => x.unit_id === u.id)
                return (
                  <div key={u.id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        disabled={u.id === unit}
                        checked={!!ru}
                        onChange={(e) =>
                          setResource({
                            ...resource,
                            units: e.target.checked
                              ? [
                                  ...resource.units,
                                  {
                                    unit_id: u.id,
                                    location: 'Unidade',
                                    capacity: 1,
                                  },
                                ]
                              : resource.units.filter(
                                  (x) => x.unit_id !== u.id,
                                ),
                          })
                        }
                      />
                      {u.name}
                    </label>
                    {ru && (
                      <div className="catalog-grid">
                        <label>
                          Localização em {u.name}
                          <input
                            required
                            maxLength={160}
                            value={ru.location}
                            onChange={(e) =>
                              setResource({
                                ...resource,
                                units: resource.units.map((x) =>
                                  x.unit_id === u.id
                                    ? { ...x, location: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Capacidade em {u.name}
                          <input
                            required
                            type="number"
                            min="1"
                            max="1000"
                            value={ru.capacity}
                            onChange={(e) =>
                              setResource({
                                ...resource,
                                units: resource.units.map((x) =>
                                  x.unit_id === u.id
                                    ? { ...x, capacity: Number(e.target.value) }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
            </fieldset>
            <p>
              Compartilhe o mesmo cadastro entre unidades e configure janelas de
              uso sem sobreposição. A capacidade descreve o recurso; não
              multiplica sua identidade física.
            </p>
            <button className="primary">Salvar recurso</button>
          </fieldset>
          {!resource.can_edit && (
            <p>Editar exige escopo de todas as unidades deste recurso.</p>
          )}
        </form>
      )}
      {tab === 'windows' && (
        <div className="catalog-grid">
          <div className="glass">
            <h3>Jornada por data e fuso</h3>
            <p>
              Turnos e exceções abrem janelas por data. Folgas e feriados
              bloqueiam o recurso, inclusive entre unidades. Para substituir um
              turno, edite sua janela. Horários usam o fuso informado na
              unidade, independentemente do dispositivo.
            </p>
            {write && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void act(
                    () =>
                      db.rpc('set_catalog_timezone', {
                        tenant,
                        unit,
                        timezone,
                      }),
                    'Fuso atualizado. Janelas anteriores conservam os instantes e fuso originais.',
                  )
                }}
              >
                <label>
                  Fuso IANA da unidade
                  <input
                    required
                    value={timezone}
                    disabled={busy || loading}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </label>
                <button disabled={busy || loading}>Salvar fuso</button>
              </form>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (
                  await act(
                    () =>
                      db.rpc('set_catalog_window', {
                        tenant,
                        unit,
                        resource: windowResource,
                        kind: windowKind,
                        local_start: start,
                        local_end: end,
                        reason,
                        window_id: windowId || undefined,
                      }),
                    'Jornada salva.',
                  )
                )
                  setWindowId(null)
              }}
            >
              <fieldset disabled={!write || busy || loading}>
                <label>
                  Recurso da jornada
                  <select
                    required
                    value={windowResource}
                    disabled={windowId !== null}
                    onChange={(e) => setWindowResource(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {windowResource &&
                      !resources.some((r) => r.id === windowResource) && (
                        <option value={windowResource}>
                          Recurso indisponível nesta unidade
                        </option>
                      )}
                    {resources
                      .filter((r) => r.active || r.id === windowResource)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {kinds[r.kind]} · {r.name}
                          {!r.active && ' · Inativo'}
                        </option>
                      ))}
                  </select>
                </label>
                {windowId && (
                  <p>
                    A edição mantém o recurso desta janela. Cancele para
                    escolher outro.
                  </p>
                )}
                <label>
                  Tipo da janela
                  <select
                    value={windowKind}
                    onChange={(e) => setWindowKind(e.target.value)}
                  >
                    {['shift', 'off', 'holiday', 'exception'].map((k) => (
                      <option key={k} value={k}>
                        {kinds[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Início local
                  <input
                    type="datetime-local"
                    required
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value)
                      setFree(null)
                      applyDuration(e.target.value)
                    }}
                  />
                </label>
                <label>
                  Fim local
                  <input
                    type="datetime-local"
                    required
                    value={end}
                    onChange={(e) => {
                      setEnd(e.target.value)
                      setFree(null)
                    }}
                  />
                </label>
                <label>
                  Motivo administrativo
                  <input
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="primary">
                  {windowId ? 'Salvar alteração da janela' : 'Salvar jornada'}
                </button>
                {windowId && (
                  <button type="button" onClick={() => setWindowId(null)}>
                    Cancelar edição da janela
                  </button>
                )}
              </fieldset>
            </form>
          </div>
          <form
            className="glass"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError('')
              try {
                const r = await db.rpc('catalog_availability', {
                  tenant,
                  unit,
                  local_start: start,
                  local_end: end,
                  version_id: selectedVersion || undefined,
                })
                if (r.error) fail(r.error.code)
                else setFree(r.data as unknown as Free[])
              } catch {
                fail()
              } finally {
                setBusy(false)
              }
            }}
          >
            <h3>Encontrar recursos livres</h3>
            <p>
              Consulta das janelas configuradas no início e fim acima. O
              intervalo deve corresponder à duração do serviço, sem buffers. Com
              serviço, inclui buffers, habilitação e capacidades. A ocupação
              real fica na agenda.
            </p>
            <label>
              Serviço para disponibilidade
              <select
                value={selectedVersion}
                onChange={(e) => {
                  setSelectedVersion(e.target.value)
                  setFree(null)
                  applyDuration(start, e.target.value)
                }}
              >
                <option value="">Todos os recursos</option>
                {serviceOptions
                  .filter((s) => s.state === 'published')
                  .map((s) => (
                    <option key={s.version_id} value={s.version_id}>
                      {s.name} · v{s.version}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy}>Consultar disponibilidade</button>
            {free !== null && (
              <>
                <p>Resultado informativo · até 30 recursos por página.</p>
                {free.length ? (
                  free.map((r) => (
                    <p key={r.id}>
                      {kinds[r.kind]} · {r.name} ·{' '}
                      {r.available
                        ? 'Livre na configuração'
                        : 'Sem janela livre'}{' '}
                      · {r.location} · capacidade {r.capacity}
                    </p>
                  ))
                ) : (
                  <p>Nenhum recurso elegível.</p>
                )}
                {free.length > 0 && free.length % 30 === 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const r = await db.rpc('catalog_availability', {
                        tenant,
                        unit,
                        local_start: start,
                        local_end: end,
                        version_id: selectedVersion || undefined,
                        after_id: free.at(-1)?.id,
                      })
                      if (r.error) fail(r.error.code)
                      else setFree([...free, ...(r.data as unknown as Free[])])
                    }}
                  >
                    Mais recursos disponíveis
                  </button>
                )}
              </>
            )}
          </form>
        </div>
      )}
    </section>
  )
}
