import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
type Row = {
  event_id: string
  operation: string
  state: string
  code: string
  correlation_id: string
  task_id: string | null
  task_state: string | null
  external_ref: string | null
  simulated: boolean
}
export function ClinicIntegrations({
  db,
  tenant,
  unit
}: {
  db: SupabaseClient<Database>
  tenant: string
  unit: string
}) {
  const [rows, setRows] = useState<Row[] | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve(
      db.rpc('flw_operations', { tenant, unit }).abortSignal(controller.signal)
    )
      .then(({ data, error }) => {
        if (!controller.signal.aborted) {
          setRows(error ? [] : (data as Row[]))
          if (error) setMessage('Não foi possível consultar as operações.')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRows([])
          setMessage('Não foi possível consultar as operações.')
        }
      })
    return () => controller.abort()
  }, [db, tenant, unit, revision])
  return (
    <section>
      <h3>Integração FLW · modo manual</h3>
      <p>
        Capacidades aguardam homologação. Nenhuma cobrança, mensagem ou
        alteração é enviada à FLW.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setMessage('')
          try {
            const form = new FormData(e.currentTarget)
            const { error } = await db.rpc('request_flw_operation', {
              tenant,
              unit,
              operation: String(form.get('operation')),
              entity: crypto.randomUUID(),
              version: 1,
              correlation: crypto.randomUUID(),
              simulation: false
            })
            setMessage(
              error
                ? 'Não foi possível registrar. Confira seu acesso.'
                : 'CAPABILITY_NOT_VERIFIED: tarefa manual registrada.'
            )
            setRevision((v) => v + 1)
          } catch {
            setMessage('Não foi possível registrar. Confira seu acesso.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label htmlFor="flw-operation">Operação manual</label>
        <select id="flw-operation" name="operation">
          <option value="contact.lookup">Localizar e vincular contato</option>
          <option value="card.update">Atualizar card no CRM</option>
          <option value="charge.create">Solicitar e conferir cobrança</option>
          <option value="automation.trigger">
            Executar automação aprovada
          </option>
        </select>
        <button disabled={busy}>Registrar tarefa manual</button>
      </form>
      {message && <p role="status">{message}</p>}
      {rows === null ? (
        <p role="status">Carregando operações…</p>
      ) : !rows.length ? (
        <p>Nenhuma operação registrada nesta unidade.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.event_id}>
              <strong>
                {
                  (
                    {
                      'contact.lookup': 'Contato',
                      'card.update': 'Card',
                      'charge.create': 'Cobrança',
                      'automation.trigger': 'Automação'
                    } as Record<string, string>
                  )[row.operation]
                }
              </strong>{' '}
              ·{' '}
              {row.simulated
                ? 'Simulação'
                : row.task_state === 'done'
                  ? 'Concluída manualmente'
                  : 'Ação manual pendente'}
              <p>
                Correlação: {row.correlation_id} · {row.code}
              </p>
              {row.external_ref && <p>Vínculo: {row.external_ref}</p>}
              {row.task_id && row.task_state === 'open' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setBusy(true)
                    try {
                      const reference = String(
                        new FormData(e.currentTarget).get('reference')
                      )
                      const { error } = await db.rpc(
                        'complete_flw_manual_task',
                        {
                          tenant,
                          task: row.task_id!,
                          reference
                        }
                      )
                      setMessage(
                        error
                          ? 'Use uma referência opaca válida e confira seu acesso.'
                          : 'Conclusão manual registrada. Confira o resultado na FLW.'
                      )
                      setRevision((v) => v + 1)
                    } catch {
                      setMessage(
                        'Não foi possível concluir a tarefa. Tente novamente.'
                      )
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <label htmlFor={`ref-${row.task_id}`}>
                    Referência externa (somente ID, sem conteúdo privado)
                  </label>
                  <input
                    id={`ref-${row.task_id}`}
                    name="reference"
                    pattern="[A-Za-z0-9_-]+"
                    maxLength={100}
                    required
                  />
                  <button disabled={busy}>Concluir tarefa com vínculo</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
