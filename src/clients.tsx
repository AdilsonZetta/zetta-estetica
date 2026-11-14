import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from './database.types'
import { registerContextCleanup, trackPreview, releasePreview } from './context'

type Client = {
  id: string
  name: string
  phone_raw: string | null
  phone_e164: string | null
  email: string | null
  version: number
  state: string
  merged_into: string | null
}
type CrmLink = {
  id: string
  kind: string
  external_ref: string
  integration_id: string
  state: string
  mode: string
  source_ref: string
  updated_at: string
}
type Detail = {
  client: Client
  links: CrmLink[]
  history: {
    id: string
    client_id: string
    action: string
    actor_id: string
    occurred_at: string
    effects: Json
  }[]
  modules: { key: string; name: string }[]
}
type Preview = {
  total: number
  rejected: number
  review: number
  rows: {
    line: number
    name: string
    phone_e164: string | null
    source_ref: string
    status: string
    candidates: { id: string; name: string }[]
    errors: string[]
  }[]
}
const sample = JSON.stringify(
  [
    { name: 'Maria Silva', phone: '(11) 99999-0101', source_ref: 'amostra_1' },
    { name: 'Maria Silva', phone: '(11) 99999-0101', source_ref: 'amostra_2' },
    { name: '', phone: '123', source_ref: 'amostra_3' }
  ],
  null,
  2
)
const actions: Record<string, string> = {
  client_created: 'Cadastro criado',
  client_updated: 'Cadastro atualizado',
  client_link_reviewed: 'Vínculo FLW revisado',
  client_merged: 'Cadastro mesclado e arquivado',
  client_merge_received: 'Merge recebido'
}
const states: Record<string, string> = {
  pending_review: 'Pendente de revisão',
  confirmed: 'Confirmado manualmente',
  retired: 'Encerrado'
}

export function ClinicClients({
  db,
  tenant,
  unit
}: {
  db: SupabaseClient<Database>
  tenant: string
  unit: string
}) {
  const [rows, setRows] = useState<Client[]>([]),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState('')
  const [selected, setSelected] = useState(''),
    [detail, setDetail] = useState<Detail | null>(null),
    [tab, setTab] = useState('cadastro')
  const [loading, setLoading] = useState(true),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0)
  const [write, setWrite] = useState(false),
    [merge, setMerge] = useState(false),
    [target, setTarget] = useState<Detail | null>(null),
    [mergeTarget, setMergeTarget] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null),
    [input, setInput] = useState(sample),
    [page, setPage] = useState<string | undefined>()
  useEffect(() => {
    let live = true
    const controller = new AbortController(),
      unregister = registerContextCleanup(() => controller.abort())
    setLoading(true)
    setError('')
    setRows([])
    Promise.all([
      db
        .rpc('search_clients', { tenant, unit, query: search, after_id: page })
        .abortSignal(controller.signal),
      db
        .rpc('check_access', { tenant, unit, permission: 'clients.write' })
        .abortSignal(controller.signal),
      db
        .rpc('check_access', { tenant, unit, permission: 'clients.merge' })
        .abortSignal(controller.signal)
    ])
      .then(([r, w, m]) => {
        if (!live) return
        if (r.error || w.error || m.error) throw Error()
        setRows(r.data as unknown as Client[])
        setWrite(w.data)
        setMerge(m.data)
      })
      .catch(() => {
        if (live)
          setError(
            'Não foi possível carregar clientes. Confira seu acesso e tente novamente.'
          )
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
      controller.abort()
      unregister()
    }
  }, [db, tenant, unit, search, page, revision])
  useEffect(() => {
    let live = true
    const controller = new AbortController(),
      unregister = registerContextCleanup(() => controller.abort())
    setDetail(null)
    setTarget(null)
    setMergeTarget('')
    if (selected)
      Promise.resolve(
        db
          .rpc('client_detail', { tenant, unit, client: selected })
          .abortSignal(controller.signal)
      )
        .then((r) => {
          if (!live) return
          if (r.error) throw Error()
          setDetail(r.data as unknown as Detail)
        })
        .catch(() => {
          if (live)
            setError('Ficha indisponível. Recarregue para tentar novamente.')
        })
    return () => {
      live = false
      controller.abort()
      unregister()
    }
  }, [db, tenant, unit, selected, revision])
  function selectClient(id: string) {
    setError('')
    setMessage('')
    if (id === selected) setRevision((v) => v + 1)
    setSelected(id)
    setDetail(null)
    setTarget(null)
    setMergeTarget('')
    setTab('cadastro')
  }
  async function run(
    operation: () => PromiseLike<{ error: unknown }>,
    success: string
  ) {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const r = await operation()
      if (r.error) {
        const e = r.error as { code?: string }
        setError(
          e.code === '40001'
            ? 'A ficha mudou. Recarregue e refaça a revisão.'
            : e.code === '23505'
              ? 'Identificador FLW já vinculado nesta conexão. Revise os cadastros.'
              : 'Operação recusada. Confira acesso, campos e revisão de correspondências.'
        )
        return
      }
      setMessage(success)
      setRevision((v) => v + 1)
    } catch {
      setError('Serviço indisponível. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }
  const c = detail?.client
  return (
    <section aria-label="Cadastro de clientes" className="clients">
      <h3>Clientes</h3>
      <p>
        Cadastro operacional por unidade · FLW em modo manual. Nome ou telefone
        não identificam uma pessoa de forma única.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setPage(undefined)
          setSearch(query)
          setRevision((v) => v + 1)
        }}
      >
        <label htmlFor="client-search">Pesquisar por nome ou telefone</label>
        <input
          id="client-search"
          value={query}
          maxLength={160}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={loading}>Pesquisar clientes</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Carregando clientes…</p>
      ) : !rows.length ? (
        <p>Nenhum cliente nesta pesquisa.</p>
      ) : (
        <ul className="client-list">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => {
                  selectClient(r.id)
                }}
              >
                {r.name} · {r.phone_e164 || r.phone_raw || 'Sem telefone'}
                {r.state === 'archived' ? ' · Arquivado' : ''}
              </button>
              <small>{r.id}</small>
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        {page && (
          <button onClick={() => setPage(undefined)}>Primeira página</button>
        )}
        {rows.length === 50 && (
          <button onClick={() => setPage(rows.at(-1)!.id)}>
            Próximos 50 clientes
          </button>
        )}
        {write && (
          <button
            onClick={() => {
              selectClient('')
            }}
          >
            Novo cliente
          </button>
        )}
      </div>
      {selected && !detail && !error && <p role="status">Carregando ficha…</p>}
      {c && (
        <article className="tenant-card">
          <h4>Ficha resumida · {c.name}</h4>
          <p>
            UUID: {c.id}
            <br />
            Telefone: {c.phone_e164 || c.phone_raw || 'Não informado'}
            <br />
            E-mail: {c.email || 'Não informado'}
            <br />
            Versão: {c.version} · {c.state === 'active' ? 'Ativo' : 'Arquivado'}
          </p>
          {c.merged_into && (
            <button onClick={() => selectClient(c.merged_into!)}>
              Abrir cadastro sobrevivente
            </button>
          )}
          <div
            className="actions"
            role="tablist"
            aria-label="Histórico do cliente"
          >
            {[
              { key: 'cadastro', name: 'Cadastro e CRM' },
              { key: 'historico', name: 'Histórico cadastral' },
              ...detail.modules.map((m) => ({ key: m.key, name: m.name }))
            ].map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'historico' ? (
              <ul>
                {detail.history.map((h) => (
                  <li key={h.id}>
                    {actions[h.action] || h.action} ·{' '}
                    {new Date(h.occurred_at).toLocaleString('pt-BR')}
                    <details>
                      <summary>Autoria e efeitos</summary>
                      <p>
                        Usuário: {h.actor_id} · Cadastro de origem:{' '}
                        {h.client_id}
                      </p>
                      <pre>{JSON.stringify(h.effects, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            ) : tab !== 'cadastro' ? (
              <p>
                Nenhum histórico operacional disponível. O módulo{' '}
                {detail.modules.find((m) => m.key === tab)?.name} está
                habilitado; seus registros operacionais serão disponibilizados
                na etapa correspondente.
              </p>
            ) : (
              <>
                <h4>Referências do CRM FLW</h4>
                <p>
                  URL de card não homologada. Localize o identificador abaixo na
                  conta FLW correspondente à conexão. Confirme manualmente a
                  pessoa e a unidade.
                </p>
                <button disabled title="Deep link FLW ainda não verificado">
                  Abrir no CRM FLW · indisponível
                </button>
                {!detail.links.length && <p>Nenhum vínculo FLW registrado.</p>}
                {detail.links.map((l) => (
                  <article key={l.id}>
                    <p>
                      {l.kind === 'card' ? 'Card' : 'Contato'}:{' '}
                      <strong>{l.external_ref}</strong> · {states[l.state]}
                      <br />
                      Conexão: {l.integration_id}
                      <br />
                      Modo{' '}
                      {l.mode === 'synchronized' ? 'sincronizado' : 'manual'} ·
                      Origem: {l.source_ref} · Atualizado:{' '}
                      {new Date(l.updated_at).toLocaleString('pt-BR')}
                    </p>
                    {write && c.state === 'active' && l.state !== 'retired' && (
                      <div className="actions">
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                db.rpc('set_client_link', {
                                  tenant,
                                  unit,
                                  client: c.id,
                                  kind: l.kind,
                                  reference: l.external_ref,
                                  source: l.source_ref,
                                  link: l.id,
                                  expected_version: c.version,
                                  link_state: 'confirmed'
                                }),
                              'Vínculo confirmado após revisão manual.'
                            )
                          }
                        >
                          Confirmar vínculo {l.external_ref}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                db.rpc('set_client_link', {
                                  tenant,
                                  unit,
                                  client: c.id,
                                  kind: l.kind,
                                  reference: l.external_ref,
                                  source: l.source_ref,
                                  link: l.id,
                                  expected_version: c.version,
                                  link_state: 'retired'
                                }),
                              'Vínculo encerrado. Histórico preservado.'
                            )
                          }
                        >
                          Encerrar vínculo {l.external_ref}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {write && c.state === 'active' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const f = new FormData(e.currentTarget)
                      void run(
                        () =>
                          db.rpc('set_client_link', {
                            tenant,
                            unit,
                            client: c.id,
                            kind: String(f.get('kind')),
                            reference: String(f.get('reference')),
                            source: String(f.get('source'))
                          }),
                        'Vínculo manual registrado para revisão.'
                      )
                    }}
                  >
                    <label htmlFor="link-kind">Tipo de vínculo FLW</label>
                    <select name="kind" id="link-kind">
                      <option value="contact">Contato</option>
                      <option value="card">Card</option>
                    </select>
                    <label htmlFor="link-ref">Identificador FLW</label>
                    <input
                      id="link-ref"
                      name="reference"
                      pattern="[A-Za-z0-9_-]{1,100}"
                      required
                    />
                    <label htmlFor="link-source">
                      Referência do registro de origem
                    </label>
                    <input
                      id="link-source"
                      name="source"
                      pattern="[A-Za-z0-9_-]{1,100}"
                      required
                    />
                    <button disabled={busy}>Registrar vínculo manual</button>
                  </form>
                )}
              </>
            )}
          </div>
        </article>
      )}
      {write && (!selected || c?.state === 'active') && tab === 'cadastro' && (
        <form
          key={`${c?.id || 'new'}:${c?.version || 0}`}
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            void run(async () => {
              const r = await db.rpc('save_client', {
                tenant,
                unit,
                name: String(f.get('name')),
                phone: String(f.get('phone')),
                email: String(f.get('email')),
                client: c?.id,
                expected_version: c?.version,
                reviewed: f.get('reviewed') === 'on'
              })
              if (!r.error) setSelected(r.data!)
              return r
            }, 'Cadastro salvo.')
          }}
        >
          <h4>{c ? 'Editar contato' : 'Cadastro mínimo'}</h4>
          <label htmlFor="client-name">Nome do cliente</label>
          <input
            id="client-name"
            name="name"
            required
            maxLength={160}
            defaultValue={c?.name}
          />
          <label htmlFor="client-phone">Telefone (com DDD ou +país)</label>
          <input
            id="client-phone"
            name="phone"
            type="tel"
            maxLength={60}
            defaultValue={c?.phone_raw || ''}
          />
          <label htmlFor="client-email">E-mail do cliente (opcional)</label>
          <input
            id="client-email"
            name="email"
            type="email"
            maxLength={254}
            defaultValue={c?.email || ''}
          />
          <label>
            <input type="checkbox" name="reviewed" /> Revisei os homônimos,
            telefone compartilhado e dados incompletos na pesquisa; este
            cadastro é intencional.
          </label>
          <button className="primary" disabled={busy}>
            Salvar cliente
          </button>
        </form>
      )}
      {merge && c?.state === 'active' && (
        <details>
          <summary>Merge supervisionado</summary>
          <p>
            O cadastro selecionado será arquivado. O sobrevivente mantém seus
            contatos; somente vínculos FLW são movidos. O histórico permanece
            com sua autoria e origem.
          </p>
          <label htmlFor="merge-target">UUID do sobrevivente</label>
          <input
            id="merge-target"
            value={mergeTarget}
            onChange={(e) => {
              setMergeTarget(e.target.value)
              setTarget(null)
            }}
          />
          <button
            disabled={busy}
            onClick={async () => {
              const id = mergeTarget.trim().toLowerCase()
              setTarget(null)
              setError('')
              if (id === c.id) {
                setError('Escolha outro cliente como sobrevivente.')
                return
              }
              if (
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
                  id
                )
              ) {
                setError('Informe um UUID válido para o sobrevivente.')
                return
              }
              setBusy(true)
              setError('')
              try {
                const r = await db.rpc('client_detail', {
                  tenant,
                  unit,
                  client: id
                })
                if (r.error) throw Error()
                const candidate = r.data as unknown as Detail
                if (candidate.client.state !== 'active') {
                  setError(
                    'O sobrevivente está arquivado. Escolha um cliente ativo.'
                  )
                  return
                }
                setTarget(candidate)
              } catch {
                setError('Sobrevivente indisponível nesta unidade.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Preparar revisão do merge
          </button>
          {target && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                void run(
                  () =>
                    db.rpc('merge_clients', {
                      tenant,
                      unit,
                      source: c.id,
                      survivor: target.client.id,
                      source_version: c.version,
                      survivor_version: target.client.version,
                      reason: String(f.get('reason')),
                      confirmed: f.get('confirmed') === 'on'
                    }),
                  'Merge concluído. Origem arquivada e histórico preservado.'
                )
              }}
            >
              <p>
                Arquivar: {c.name} · {c.id} · v{c.version}
                <br />
                Preservar: {target.client.name} · {target.client.id} · v
                {target.client.version}
                <br />
                Telefone sobrevivente:{' '}
                {target.client.phone_e164 ||
                  target.client.phone_raw ||
                  'Não informado'}{' '}
                · E-mail: {target.client.email || 'Não informado'}
                <br />
                Vínculos a mover: {detail?.links.length}. Vínculos no
                sobrevivente: {target.links.length}.
              </p>
              <label htmlFor="merge-reason">Motivo do merge</label>
              <input
                id="merge-reason"
                name="reason"
                required
                minLength={5}
                maxLength={300}
              />
              <label>
                <input name="confirmed" type="checkbox" required /> Conferi as
                duas identidades e autorizo o merge.
              </label>
              <button disabled={busy}>Confirmar merge supervisionado</button>
            </form>
          )}
        </details>
      )}
      {write && (
        <details>
          <summary>Prévia de importação</summary>
          <p>
            Amostra JSON de até 100 linhas/100 KB. Mapeamento manual v1: name,
            phone, email, source_ref. Esta prévia não grava nem sincroniza
            clientes.
          </p>
          <label htmlFor="import-sample">Amostra de clientes (JSON)</label>
          <textarea
            id="import-sample"
            value={input}
            maxLength={100000}
            rows={10}
            onChange={(e) => {
              setInput(e.target.value)
              setPreview(null)
            }}
          />
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setPreview(null)
              setError('')
              try {
                const r = await db.rpc('preview_client_import', {
                  tenant,
                  unit,
                  rows: JSON.parse(input)
                })
                if (r.error) throw Error()
                setPreview(r.data as unknown as Preview)
              } catch {
                setError(
                  'Amostra inválida ou acesso negado. Use um array JSON de até 100 linhas.'
                )
              } finally {
                setBusy(false)
              }
            }}
          >
            Gerar prévia sem importar
          </button>
          {preview && (
            <>
              <p role="status">
                {preview.total} linhas · {preview.rejected} rejeições ·{' '}
                {preview.review} exigem revisão. Nenhuma gravação.
              </p>
              <ul>
                {preview.rows.map((r) => (
                  <li key={r.line}>
                    Linha {r.line}: {r.name || 'Sem nome'} ·{' '}
                    {r.phone_e164 || 'Sem E.164'} ·{' '}
                    {r.status === 'rejected'
                      ? 'Rejeitada'
                      : r.status === 'review'
                        ? 'Revisão obrigatória'
                        : 'Novo candidato'}
                    {r.errors.map((e) => (
                      <p key={e}>{e}</p>
                    ))}
                    {r.candidates.map((m) => (
                      <p key={m.id}>
                        Correspondência possível: {m.name} · {m.id}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  const url = trackPreview(
                    URL.createObjectURL(
                      new Blob([JSON.stringify(preview, null, 2)], {
                        type: 'application/json'
                      })
                    )
                  )
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'previa-clientes-rejeicoes.json'
                  a.click()
                  window.setTimeout(() => releasePreview(url), 1000)
                }}
              >
                Baixar relatório de rejeições e revisão
              </button>
            </>
          )}
        </details>
      )}
    </section>
  )
}
