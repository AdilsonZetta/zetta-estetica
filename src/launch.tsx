import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registerContextCleanup } from './context'
import type { Database } from './database.types'
import { approvedReturnUrl } from '../integration-lab/lab'

type Context = { id: string; name: string; slug: string }
export function ReturnAction({ showSwitchClinic = false }: { showSwitchClinic?: boolean }) {
  const url = approvedReturnUrl(import.meta.env.VITE_FLW_RETURN_URL)
  if (!showSwitchClinic && !url) return null
  return (
    <p>
      {showSwitchClinic && <Link to="/launch">Escolher outra clínica</Link>}
      {url && (
        <>
          {showSwitchClinic && ' · '}
          <a href={url} target="_blank" rel="noopener noreferrer">
            Voltar à FLW
          </a>
        </>
      )}
    </p>
  )
}
export function Launch({ db }: { db: SupabaseClient<Database> }) {
  const { slug } = useParams()
  const [rows, setRows] = useState<Context[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    const controller = new AbortController()
    const unregister = registerContextCleanup(() => controller.abort())
    Promise.resolve(
      db
        .rpc('launch_context', { destination: slug })
        .abortSignal(controller.signal)
    )
      .then(({ data, error }) => {
        if (!live) return
        if (error)
          setError('Não foi possível verificar o acesso. Tente novamente.')
        else setRows(data)
      })
      .catch(() => {
        if (live)
          setError('Não foi possível verificar o acesso. Tente novamente.')
      })
    return () => {
      live = false
      controller.abort()
      unregister()
    }
  }, [db, slug])
  if (error)
    return (
      <section className="glass">
        <p role="alert">{error}</p>
        <ReturnAction showSwitchClinic={!!slug} />
      </section>
    )
  if (!rows) return <p role="status">Validando vínculo com a clínica…</p>
  if (rows.length === 1)
    return <Navigate replace to={`/clinicas/${rows[0].slug}`} />
  return (
    <section className="glass">
      <h2>{slug ? 'Acesso indisponível' : 'Suas clínicas'}</h2>
      {!rows.length ? (
        <p>
          {slug
            ? 'Sua conta não possui acesso vigente a este destino. Solicite um convite ao administrador.'
            : 'Nenhum vínculo ativo. Solicite um convite ao administrador.'}
        </p>
      ) : (
        <>
          <p>Escolha a clínica para continuar.</p>
          <div className="cards">
            {rows.map((t) => (
              <Link className="tenant-card" key={t.id} to={`/launch/${t.slug}`}>
                {t.name}
              </Link>
            ))}
          </div>
        </>
      )}
      <ReturnAction showSwitchClinic={!!slug} />
    </section>
  )
}
