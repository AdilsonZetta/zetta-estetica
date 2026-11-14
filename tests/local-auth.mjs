import { existsSync, readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Só o processo Node lê o cofre local; não importar este módulo na página.
export function localStackAvailable() {
  return existsSync(process.env.LOCAL_STACK_ENV_FILE || '/workspace/.stack/local.env')
}

export function localConfig() {
  const path = process.env.LOCAL_STACK_ENV_FILE || '/workspace/.stack/local.env'
  const values = Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const index = line.indexOf('=')
    return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]
  }))
  const url = new URL(values.SUPABASE_URL)
  if (url.hostname !== 'localhost' || url.port !== '54321' || url.protocol !== 'http:') throw new Error('Os testes aceitam somente a pilha local localhost:54321.')
  return { url: url.origin, anon: values.SUPABASE_ANON_KEY, service: values.SUPABASE_SERVICE_ROLE_KEY, jwtSecret: values.LOCAL_JWT_SECRET }
}

export function client(key) {
  const config = localConfig()
  return createClient(config.url, key || config.anon, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function expiredSession(session) {
  const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString())
  payload.iat = Math.floor(Date.now() / 1000) - 7200
  payload.exp = payload.iat + 60
  const parts = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url')]
  const signature = createHmac('sha256', localConfig().jwtSecret).update(parts.join('.')).digest('base64url')
  return { ...session, access_token: `${parts.join('.')}.${signature}`, expires_at: payload.exp }
}

export async function createDemoUsers() {
  const admin = client(localConfig().service)
  const users = []
  try {
    for (const clinic of ['aurora', 'horizonte']) {
      const email = `discovery-${clinic}-${randomUUID()}@example.com`
      const { data, error } = await admin.auth.admin.createUser({ email, password: 'Demo@123456', email_confirm: true, user_metadata: { simulated: true, purpose: 'prompt-00' } })
      if (error) throw new Error('Falha ao criar usuário sintético no Auth local.')
      users.push({ id: data.user.id, email, password: 'Demo@123456' })
    }
  } catch (error) {
    await Promise.all(users.map(user => admin.auth.admin.deleteUser(user.id)))
    throw error
  }
  return { users, cleanup: async () => {
    for (const user of users) {
      const { error } = await admin.auth.admin.deleteUser(user.id)
      if (error) throw new Error('Falha ao remover usuário sintético do Auth local.')
    }
  } }
}
