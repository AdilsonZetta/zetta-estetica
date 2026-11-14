import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { ReturnAction } from './launch'

export function Login({ db }: { db: SupabaseClient<Database> }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const invite = /^\/convites\/[0-9a-f-]{36}$/i.test(location.pathname)
  const [mode, setMode] = useState<'invite' | 'otp' | 'password'>(invite ? 'invite' : 'password')
  const codeMode = mode !== 'password'
  const invitationCode = mode === 'invite'
  const [manualCode, setManualCode] = useState(false)
  function changeMode(next: 'invite' | 'otp' | 'password') {
    setMode(next)
    setSent(false)
    setManualCode(false)
    setError('')
  }
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  return (
    <section className="glass login">
      <p className="step">BEM-VINDO À SUA CLÍNICA</p>
      <h2>Acesse seu espaço</h2>
      <p className="muted">Use a conta vinculada ao convite da sua clínica.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          const form = new FormData(e.currentTarget)
          try {
            if (codeMode) {
              if (sent || manualCode || invitationCode) {
                const result = await db.auth.verifyOtp({
                  email,
                  token: String(form.get('code')).trim(),
                  type: invitationCode ? 'invite' : 'email'
                })
                if (result.error)
                  setError(
                    'Código inválido, expirado ou já utilizado. Confira o e-mail ou solicite um novo envio.'
                  )
              } else {
                const result = await db.auth.signInWithOtp({
                  email,
                  options: { shouldCreateUser: false }
                })
                if (result.error)
                  setError(
                    'Não foi possível solicitar o código. Verifique seu convite ou tente mais tarde.'
                  )
                else setSent(true)
              }
            } else {
              const result = await db.auth.signInWithPassword({
                email,
                password: String(form.get('password'))
              })
              if (result.error)
                setError('Não foi possível entrar. Confira suas credenciais.')
            }
          } catch {
            setError('Serviço indisponível. Tente novamente.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setSent(false)
          }}
        />
        {codeMode ? (
          (sent || manualCode || invitationCode) && (
            <>
              <label htmlFor="code">Código do e-mail</label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={10}
              />
            </>
          )
        ) : (
          <>
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? 'Aguarde…'
            : codeMode
              ? sent || manualCode || invitationCode
                ? 'Validar código'
                : 'Enviar código por e-mail'
              : 'Entrar'}
        </button>
        {error && <p role="alert">{error}</p>}
        {sent && (
          <p role="status">
            Se a conta estiver habilitada, use o código enviado ao seu e-mail.
          </p>
        )}
      </form>
      {codeMode && !sent && !manualCode && !invitationCode && (
        <button
          onClick={() => {
            setManualCode(true)
            setError('')
          }}
        >
          Já tenho um código
        </button>
      )}
      {codeMode && (sent || manualCode) && !invitationCode && (
        <button
          onClick={() => {
            setSent(false)
            setManualCode(false)
            setError('')
          }}
        >
          Solicitar outro código
        </button>
      )}
      {!invite && (
        <button
          onClick={() => {
            changeMode(codeMode ? 'password' : 'otp')
          }}
        >
          {codeMode ? 'Usar senha' : 'Usar código por e-mail'}
        </button>
      )}
      {invite && mode !== 'otp' && (
        <button onClick={() => changeMode('otp')}>
          Acessar conta existente por código
        </button>
      )}
      {invite && mode !== 'invite' && (
        <button onClick={() => changeMode('invite')}>
          Usar código do convite
        </button>
      )}
      {invite && (
        <p>
          Use o código do convite. Se ele expirou, peça novo envio ao
          administrador. Já possui conta? Entre com ela para aceitar o convite.
        </p>
      )}
      {invite && mode !== 'password' && (
        <button onClick={() => changeMode('password')}>
          Usar senha existente
        </button>
      )}
      <ReturnAction />
    </section>
  )
}
