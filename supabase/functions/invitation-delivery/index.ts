import { deliveryHandler } from './handler.ts'
Deno.serve(
  deliveryHandler({
    url: Deno.env.get('SUPABASE_URL') || '',
    publicKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    appUrl: Deno.env.get('APP_URL') || '',
    allowedOrigin: Deno.env.get('APP_ORIGIN') || ''
  })
)
