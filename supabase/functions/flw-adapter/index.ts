import { flwHandler } from './handler.ts'
Deno.serve(
  flwHandler({
    url: Deno.env.get('SUPABASE_URL') || '',
    publicKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    origin: Deno.env.get('APP_ORIGIN') || ''
  })
)
