// Efeitos externos separados do provisionamento. Nunca devolva resposta bruta do Auth.
type Config = {
  url: string
  publicKey: string
  serviceKey: string
  appUrl: string
  allowedOrigin: string
}
export function deliveryHandler(
  config: Config,
  transport: typeof fetch = fetch
) {
  const backendUrl = config.url.replace(/\/+$/, '')
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': config.allowedOrigin,
      'Access-Control-Allow-Headers':
        'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin'
    }
    const reply = (status: number, code: string) =>
      new Response(JSON.stringify({ code }), { status, headers })
    if (
      !config.url ||
      !config.allowedOrigin ||
      !config.publicKey ||
      !config.serviceKey ||
      !/^https?:\/\//.test(config.appUrl)
    )
      return reply(503, 'SERVER_NOT_CONFIGURED')
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== config.allowedOrigin
    )
      return reply(403, 'ORIGIN_DENIED')
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, 'METHOD_DENIED')
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer '))
      return reply(401, 'SESSION_REQUIRED')
    let invitation: string
    try {
      invitation = (await request.json()).invitation
    } catch {
      return reply(400, 'INVALID_REQUEST')
    }
    if (
      typeof invitation !== 'string' ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(invitation)
    )
      return reply(400, 'INVALID_INVITATION')
    const rpc = (name: string, body: unknown, server = false) =>
      transport(`${backendUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: server ? config.serviceKey : config.publicKey,
          Authorization: server ? `Bearer ${config.serviceKey}` : authorization
        },
        body: JSON.stringify(body)
      })
    let lease: string | null = null
    try {
      // Valide a sessão e a autorização no banco ANTES de usar a chave privilegiada.
      const queued = await rpc('request_invitation_delivery', { invitation })
      if (!queued.ok) return reply(403, 'INVITATION_DENIED')
      const state = await queued.json()
      if (state === 'sent') return reply(200, 'ALREADY_SENT')
      const claimed = await rpc(
        'claim_invitation_delivery',
        { invitation },
        true
      )
      if (!claimed.ok) return reply(503, 'CLAIM_FAILED')
      const item = await claimed.json()
      if (!item) return reply(409, 'DELIVERY_IN_PROGRESS_OR_BLOCKED')
      lease = item.lease
      const redirect = `${config.appUrl.replace(/\/$/, '')}/convites/${invitation}`
      const sent = await transport(
        `${backendUrl}/auth/v1/invite?redirect_to=${encodeURIComponent(redirect)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.serviceKey,
            Authorization: `Bearer ${config.serviceKey}`
          },
          body: JSON.stringify({ email: item.email })
        }
      )
      const finished = await rpc(
        'finish_invitation_delivery',
        { invitation, lease, success: sent.ok },
        true
      )
      if (!finished.ok) return reply(503, 'DELIVERY_RESULT_PENDING')
      return sent.ok
        ? reply(200, 'AUTH_ACCEPTED')
        : reply(502, 'AUTH_DELIVERY_FAILED')
    } catch {
      if (lease) {
        try {
          await rpc(
            'finish_invitation_delivery',
            { invitation, lease, success: false },
            true
          )
        } catch {
          /* Lease expira; retry autorizado retoma. */
        }
      }
      return reply(503, 'DELIVERY_UNAVAILABLE')
    }
  }
}
