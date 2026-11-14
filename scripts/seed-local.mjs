import { execFileSync } from 'node:child_process'
import { client, localConfig } from '../tests/local-auth.mjs'
const admin = client(localConfig().service)
const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (error) throw error
for (const email of ['a@example.com', 'b@example.com', 'multi@example.com', 'revogado@example.com']) {
  if (data.users.some(u => u.email === email)) continue
  const result = await admin.auth.admin.createUser({ email, password: 'Demo@123456', email_confirm: true, user_metadata: { simulated: true } })
  if (result.error) throw result.error
}
execFileSync('psql', ['-h','localhost','-p','54322','-U','postgres','-d','zetta','-v','ON_ERROR_STOP=1','-f','supabase/seed.sql'], { stdio: 'inherit' })
execFileSync('psql', ['-h','localhost','-p','54322','-U','postgres','-d','zetta','-c',"notify pgrst, 'reload schema'"], { stdio: 'inherit' })
