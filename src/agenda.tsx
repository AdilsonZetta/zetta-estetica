import { useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type Db = SupabaseClient<Database>
type Resource = { id: string; name: string; kind: string; location: string; available?: boolean; reason?: string }
type Appointment = {
  id: string
  state: string
  version: number
  local_start: string
  local_end: string
  hold_expires_at: string | null
  client_name: string
  service_name: string
  service_version_id: string
  resource_ids: string[]
}
type Block = { id: string; resource_id: string; local_start: string; local_end: string; reason: string; version: number }
type Grid = { timezone: string; resources: Resource[]; appointments: Appointment[]; blocks: Block[] }
type Service = { id: string; version_id: string; name: string; state: string; duration_minutes: number; buffer_before: number; buffer_after: number }
type Client = { id: string; name: string; phone_e164: string | null }
type Wait = { id: string; client_name: string; service_name: string; priority: number; version: number; windows: { local_start: string; local_end: string }[] }
const states: Record<string, string> = { held: 'Reserva temporária', confirmed: 'Confirmado', checked_in: 'Check-in', cancelled: 'Cancelado', no_show: 'Falta', expired: 'Expirado' }
const kinds: Record<string, string> = { professional: 'Profissionais', room: 'Salas', equipment: 'Equipamentos' }
const clock = (value: string) => value.replace('T', ' ').slice(0, 16)
const dayStamp = (value: string) => clock(value).slice(0, 10)
const today = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const shiftDay = (day: string, amount: number) => {
  const [y, m, d] = day.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + amount))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${next.getUTCFullYear()}-${p(next.getUTCMonth() + 1)}-${p(next.getUTCDate())}`
}
const messageOf = (error: { code?: string; message?: string } | null) => {
  if (!error) return 'Não foi possível concluir a operação.'
  if (error.code === '40001') return 'A agenda mudou. Recarregue antes de tentar de novo.'
  if (error.code === '42501') return 'Acesso à agenda negado neste escopo.'
  return error.message || 'Não foi possível concluir a operação.'
}

export function ClinicAgenda({ db, tenant, unit }: { db: Db; tenant: string; unit: string }) {
  const [day, setDay] = useState(today)
  const [span, setSpan] = useState<'day' | 'week'>('day')
  const [kind, setKind] = useState('all')
  const [grid, setGrid] = useState<Grid | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [options, setOptions] = useState<Resource[]>([])
  const [chosen, setChosen] = useState<string[]>([])
  const [openings, setOpenings] = useState<string[]>([])
  const [waiting, setWaiting] = useState<Wait[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [version, setVersion] = useState('')
  const [start, setStart] = useState(`${today()}T09:30`)
  const [hold, setHold] = useState(10)
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('')
  const [blockResource, setBlockResource] = useState('')
  const [blockStart, setBlockStart] = useState(`${today()}T12:00`)
  const [blockEnd, setBlockEnd] = useState(`${today()}T13:00`)
  const [blockReason, setBlockReason] = useState('')
  const [waitStart, setWaitStart] = useState(`${today()}T09:00`)
  const [waitEnd, setWaitEnd] = useState(`${today()}T12:00`)
  const [priority, setPriority] = useState(50)
  const [entry, setEntry] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [canBook, setCanBook] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load(nextDay = day, nextSpan = span) {
    setLoading(true)
    setError('')
    const [access, board, catalog, queue] = await Promise.all([
      db.rpc('check_access', { tenant, unit, permission: 'agenda.book', module: 'agenda' }),
      db.rpc('agenda_grid', { tenant, unit, local_day: nextDay, span: nextSpan }),
      db.rpc('list_catalog', { tenant, unit, kind: 'services' }),
      db.rpc('agenda_waitlist', { tenant, unit }),
    ])
    if (board.error?.code === '42501' || access.error?.code === '42501') {
      setGrid(null)
      setError('Acesso à agenda negado neste escopo.')
    } else if (board.error || catalog.error || queue.error) setError('Falha ao carregar a agenda.')
    else {
      setCanBook(access.data === true)
      setGrid(board.data as Grid)
      setServices(((catalog.data as Service[]) || []).filter((item) => item.state === 'published'))
      setWaiting((queue.data as Wait[]) || [])
    }
    setLoading(false)
  }
  useEffect(() => { void load() }, [tenant, unit, day, span])

  async function searchClients() {
    setError('')
    const result = await db.rpc('search_clients', { tenant, unit, query })
    if (result.error) setError(messageOf(result.error))
    else setClients((result.data as Client[]) || [])
  }
  async function seeResources() {
    if (!version || !start) return
    setBusy(true)
    setError('')
    setOpenings([])
    const result = await db.rpc('agenda_availability', { tenant, unit, version_id: version, local_start: start })
    setBusy(false)
    if (result.error) setError(messageOf(result.error))
    else {
      const rows = ((result.data as { resources?: Resource[] }).resources || [])
      setOptions(rows)
      setChosen(rows.filter((row) => row.available).map((row) => row.id))
    }
  }
  async function suggest(resources: string[]) {
    const result = await db.rpc('agenda_openings', { tenant, unit, version_id: version, local_day: start.slice(0, 10), resources })
    if (!result.error) setOpenings((result.data as string[]) || [])
  }
  async function reserve(confirm: boolean) {
    if (!client || !version || chosen.length === 0) { setError('Escolha cliente, serviço e recursos.'); return }
    setBusy(true)
    setError('')
    setNotice('')
    const result = await db.rpc('agenda_reserve', {
      tenant, unit, client: client.id, version_id: version, local_start: start, resources: chosen,
      idempotency_key: crypto.randomUUID(), hold_minutes: hold, confirm, waitlist_entry: entry || undefined,
    })
    setBusy(false)
    if (result.error) {
      setError(messageOf(result.error))
      if (result.error.code === '23P01') await suggest(chosen)
      return
    }
    const payload = result.data as { state?: string; message?: string | null }
    setNotice(payload.message || (payload.state === 'confirmed' ? 'Horário confirmado. O aviso ao cliente continua manual.' : 'Reserva temporária registrada.'))
    setOpenings([])
    setEntry('')
    await load()
  }
  async function act(appointment: Appointment, action: 'confirm' | 'check_in' | 'cancel' | 'no_show') {
    if ((action === 'cancel' || action === 'no_show') && reason.trim().length < 3) { setError('Informe o motivo.'); return }
    setBusy(true)
    setError('')
    const result = await db.rpc('agenda_transition', {
      tenant, unit, appointment: appointment.id, expected_version: appointment.version, action, idempotency_key: crypto.randomUUID(), reason,
    })
    setBusy(false)
    if (result.error) setError(messageOf(result.error))
    else {
      const payload = result.data as { message?: string | null; state?: string }
      setNotice(payload.message || `Estado atualizado: ${states[payload.state || ''] || 'registrado'}.`)
      setReason('')
      await load()
    }
  }
  async function reschedule(appointment: Appointment) {
    setBusy(true)
    setError('')
    const result = await db.rpc('agenda_reschedule', {
      tenant, unit, appointment: appointment.id, expected_version: appointment.version, local_start: start,
      resources: appointment.resource_ids, idempotency_key: crypto.randomUUID(), hold_minutes: hold,
    })
    setBusy(false)
    if (result.error) {
      setError(messageOf(result.error))
      if (result.error.code === '23P01') await suggest(appointment.resource_ids)
      return
    }
    const payload = result.data as { message?: string | null; local_start?: string }
    setNotice(payload.message || `Horário atualizado para ${clock(String(payload.local_start || start))}.`)
    await load()
  }
  async function joinWaitlist(event: FormEvent) {
    event.preventDefault()
    if (!client || !version) { setError('Escolha cliente e serviço.'); return }
    setBusy(true)
    const result = await db.rpc('agenda_waitlist_join', {
      tenant, unit, client: client.id, version_id: version, priority,
      windows: [{ local_start: waitStart, local_end: waitEnd }],
      professionals: chosen.filter((id) => options.find((row) => row.id === id)?.kind === 'professional'),
      idempotency_key: crypto.randomUUID(),
    })
    setBusy(false)
    if (result.error) setError(messageOf(result.error))
    else { setNotice('Cliente incluído na lista de espera.'); await load() }
  }
  async function block(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const result = await db.rpc('agenda_block', {
      tenant, unit, resource: blockResource, local_start: blockStart, local_end: blockEnd, reason: blockReason, idempotency_key: crypto.randomUUID(),
    })
    setBusy(false)
    if (result.error) setError(messageOf(result.error))
    else { setNotice('Bloqueio rígido registrado.'); setBlockReason(''); await load() }
  }

  const resources = (grid?.resources || []).filter((row) => kind === 'all' || row.kind === kind)
  const selected = services.find((item) => item.version_id === version)
  return <div className="agenda">
    <div className="agenda-toolbar">
      <div>
        <p className="step">AGENDA</p>
        <h3>Grade do dia</h3>
      </div>
      <div className="agenda-nav">
        <button type="button" onClick={() => setDay(shiftDay(day, span === 'week' ? -7 : -1))} aria-label="Período anterior">←</button>
        <label>Dia<input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>
        <button type="button" onClick={() => setDay(shiftDay(day, span === 'week' ? 7 : 1))} aria-label="Próximo período">→</button>
        <button type="button" aria-pressed={span === 'day'} onClick={() => setSpan('day')}>Dia</button>
        <button type="button" aria-pressed={span === 'week'} onClick={() => setSpan('week')}>Semana</button>
      </div>
    </div>
    <p className="muted">Horários no fuso {grid?.timezone || 'da unidade'}. A reserva temporária dura {hold} minutos. Confirmação, falta e cancelamento geram tarefa manual: a FLW não está comprovada.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Carregando agenda…</p> : !grid ? null : <>
      <div className="agenda-tabs" role="tablist" aria-label="Tipo de recurso">
        <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>Todos</button>
        {Object.entries(kinds).map(([key, label]) => <button type="button" key={key} aria-pressed={kind === key} onClick={() => setKind(key)}>{label}</button>)}
      </div>
      {!resources.length ? <p>Nenhum recurso ativo nesta unidade.</p> : <div className="agenda-board">
        {resources.map((resource) => {
          const items = grid.appointments.filter((item) => item.resource_ids.includes(resource.id) && (span === 'day' ? dayStamp(item.local_start) === day : true))
          const blocks = grid.blocks.filter((item) => item.resource_id === resource.id && (span === 'day' ? dayStamp(item.local_start) === day : true))
          return <article className="glass" key={resource.id}>
            <h4>{resource.name}</h4>
            <p className="muted">{kinds[resource.kind] || resource.kind} · {resource.location}</p>
            {!items.length && !blocks.length ? <p>Nenhum horário neste recorte.</p> : null}
            <ul className="client-list">
              {blocks.map((item) => <li key={item.id}><span className="chip">BLOQUEIO</span><strong>{clock(item.local_start)} – {clock(item.local_end)}</strong><span>{item.reason}</span></li>)}
              {items.map((item) => <li key={`${resource.id}:${item.id}`}>
                <span className="chip">{states[item.state] || item.state}</span>
                <strong>{clock(item.local_start)} – {clock(item.local_end)}</strong>
                <span>{item.client_name} · {item.service_name}</span>
                {canBook && <span className="agenda-actions">
                  {item.state === 'held' && <button type="button" className="primary" disabled={busy} onClick={() => void act(item, 'confirm')}>Confirmar</button>}
                  {item.state === 'confirmed' && <button type="button" className="primary" disabled={busy} onClick={() => void act(item, 'check_in')}>Check-in</button>}
                  {item.state === 'confirmed' && <button type="button" disabled={busy} onClick={() => void act(item, 'no_show')}>Falta</button>}
                  {['held', 'confirmed', 'checked_in'].includes(item.state) && <button type="button" disabled={busy} onClick={() => void act(item, 'cancel')}>Cancelar</button>}
                  {['held', 'confirmed'].includes(item.state) && <button type="button" disabled={busy} onClick={() => void reschedule(item)}>Reagendar para o horário selecionado</button>}
                </span>}
              </li>)}
            </ul>
          </article>
        })}
      </div>}
    </>}
    {canBook && <form className="glass" onSubmit={(event) => { event.preventDefault(); void reserve(false) }}>
      <h3>Nova reserva</h3>
      <label>Buscar cliente<input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <button type="button" onClick={() => void searchClients()}>Pesquisar</button>
      {!!clients.length && <ul className="client-list">{clients.map((item) => <li key={item.id}><button type="button" aria-pressed={client?.id === item.id} onClick={() => setClient(item)}>{item.name}{item.phone_e164 ? ` · ${item.phone_e164}` : ''}</button></li>)}</ul>}
      {client && <p>Cliente selecionado: {client.name}</p>}
      <label>Serviço publicado<select value={version} onChange={(event) => { setVersion(event.target.value); setOptions([]); setChosen([]) }}>
        <option value="">Selecione</option>
        {services.map((item) => <option key={item.version_id} value={item.version_id}>{item.name} · {item.duration_minutes} min</option>)}
      </select></label>
      {selected && <p className="catalog-preview">Ocupação de {selected.duration_minutes + selected.buffer_before + selected.buffer_after} min, com buffers {selected.buffer_before}/{selected.buffer_after}. A consulta abaixo é informativa até a RPC confirmar.</p>}
      <label>Início local<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label>
      <label>Minutos da reserva temporária<input type="number" min={1} max={30} value={hold} onChange={(event) => setHold(Number(event.target.value))} /></label>
      <button type="button" disabled={busy || !version} onClick={() => void seeResources()}>Ver recursos para este horário</button>
      {!!options.length && <fieldset><legend>Recursos</legend>{options.map((row) => <label className="check" key={row.id}><input type="checkbox" checked={chosen.includes(row.id)} disabled={!row.available && !chosen.includes(row.id)} onChange={(event) => setChosen(event.target.checked ? [...chosen, row.id] : chosen.filter((id) => id !== row.id))} />{row.name} · {row.reason || (row.available ? 'livre' : 'indisponível')}</label>)}</fieldset>}
      {!!openings.length && <div><p>Horários livres neste dia para a seleção atual:</p><div className="agenda-nav">{openings.map((item) => <button type="button" key={item} onClick={() => setStart(item)}>{clock(item)}</button>)}</div></div>}
      <label>Motivo para cancelar ou registrar falta<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} /></label>
      <label>Encaixe da lista de espera<select value={entry} onChange={(event) => setEntry(event.target.value)}><option value="">Novo horário, sem fila</option>{waiting.map((item) => <option key={item.id} value={item.id}>{item.client_name} · prioridade {item.priority}</option>)}</select></label>
      <div className="agenda-nav">
        <button className="primary" disabled={busy} type="submit">Reservar temporariamente</button>
        <button type="button" disabled={busy} onClick={() => void reserve(true)}>Confirmar agora</button>
      </div>
    </form>}
    {canBook && <form className="glass" onSubmit={(event) => void joinWaitlist(event)}>
      <h3>Lista de espera</h3>
      {!waiting.length ? <p>Nenhum cliente aguardando encaixe.</p> : <ul className="client-list">{waiting.map((item) => <li key={item.id}><strong>{item.client_name}</strong><span>Prioridade {item.priority} · {item.service_name}</span><span>{item.windows.map((window) => `${clock(window.local_start)} – ${clock(window.local_end)}`).join(' · ')}</span><button type="button" onClick={() => setEntry(item.id)}>Usar na reserva</button></li>)}</ul>}
      <label>Janela aceita, início<input type="datetime-local" value={waitStart} onChange={(event) => setWaitStart(event.target.value)} required /></label>
      <label>Janela aceita, fim<input type="datetime-local" value={waitEnd} onChange={(event) => setWaitEnd(event.target.value)} required /></label>
      <label>Prioridade<input type="number" min={1} max={100} value={priority} onChange={(event) => setPriority(Number(event.target.value))} /></label>
      <button className="primary" disabled={busy}>Incluir na lista</button>
    </form>}
    {canBook && <form className="glass" onSubmit={(event) => void block(event)}>
      <h3>Bloqueio rígido</h3>
      <label>Recurso<select value={blockResource} onChange={(event) => setBlockResource(event.target.value)} required><option value="">Selecione</option>{(grid?.resources || []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>Início<input type="datetime-local" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} required /></label>
      <label>Fim<input type="datetime-local" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} required /></label>
      <label>Motivo<input value={blockReason} onChange={(event) => setBlockReason(event.target.value)} required maxLength={500} /></label>
      <button disabled={busy}>Bloquear intervalo</button>
    </form>}
  </div>
}
