import { route, type Ports, type Operation } from './contract.ts'
import { bounded, simulationPorts } from './transport.ts'
type Config = {
  url: string
  publicKey: string
  serviceKey: string
  origin: string
}
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
// Transportes e logger injetáveis nos testes; produção usa exclusivamente fixture explícita.
export function flwHandler(
  config: Config,
  transport: typeof fetch = fetch,
  ports: Ports = simulationPorts,
  log: (entry: object) => void = console.info
) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': config.origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin'
    }
    const reply = (status: number, data: object) =>
      new Response(JSON.stringify(data), { status, headers })
    if (
      !config.url ||
      !config.publicKey ||
      !config.serviceKey ||
      !config.origin
    )
      return reply(503, { code: 'SERVER_NOT_CONFIGURED' })
    if (
      request.headers.has('origin') &&
      request.headers.get('origin') !== config.origin
    )
      return reply(403, { code: 'ORIGIN_DENIED' })
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, { code: 'METHOD_DENIED' })
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer '))
      return reply(401, { code: 'SESSION_REQUIRED' })
    let body
    try {
      const raw = await request.text()
      if (raw.length > 4096) return reply(413, { code: 'INVALID_REQUEST' })
      body = JSON.parse(raw)
      if (!body || typeof body !== 'object') throw new Error()
    } catch {
      return reply(400, { code: 'INVALID_REQUEST' })
    }
    const { tenant, unit, action } = body
    if (!uuid(tenant) || !uuid(unit) || !['request', 'work'].includes(action))
      return reply(400, { code: 'INVALID_REQUEST' })
    const rpc = async (name: string, args: object, server = false) => {
      const response = await transport(
        `${config.url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
          headers: {
            'Content-Type': 'application/json',
            apikey: server ? config.serviceKey : config.publicKey,
            Authorization: server
              ? `Bearer ${config.serviceKey}`
              : authorization
          },
          body: JSON.stringify(args)
        }
      )
      if (!response.ok) throw new Error('RPC_DENIED')
      return response.json()
    }
    let context: {
      event_id?: string
      correlation_id?: string
      simulated?: boolean
    } = {}
    try {
      if (action === 'request') {
        if (
          ![
            'contact.lookup',
            'card.update',
            'charge.create',
            'automation.trigger'
          ].includes(body.operation) ||
          !uuid(body.entity) ||
          !uuid(body.correlation) ||
          !Number.isSafeInteger(body.version) ||
          body.version < 1 ||
          (body.simulation !== undefined &&
            typeof body.simulation !== 'boolean')
        )
          return reply(400, { code: 'INVALID_REQUEST' })
        context = {
          correlation_id: body.correlation,
          simulated: body.simulation ?? false
        }
        // Contexto do usuário propagado; esta operação NÃO utiliza service role.
        const result = await rpc('request_flw_operation', {
          tenant,
          unit,
          operation: body.operation,
          entity: body.entity,
          version: body.version,
          correlation: body.correlation,
          simulation: body.simulation ?? false
        })
        return reply(200, result)
      }
      // Antes do cliente de serviço, RPC valida vínculo vigente, unidade, permissão e módulo.
      const jobs = await rpc('flw_work_candidates', { tenant, unit })
      if (!Array.isArray(jobs)) throw new Error('RPC_DENIED')
      let processed = 0
      for (const job of jobs) {
        context = {
          event_id: job.event_id,
          correlation_id: job.correlation_id,
          simulated: Boolean(job.simulated)
        }
        const item = await rpc(
          'claim_flw_delivery',
          { tenant, delivery: job.delivery_id },
          true
        )
        if (!item) continue
        context = {
          event_id: item.event_id,
          correlation_id: item.correlation_id,
          simulated: Boolean(item.simulated)
        }
        let outcome
        try {
          outcome = await bounded(
            route(ports, item.operation as Operation, item),
            8000
          )
        } catch {
          outcome = 'OUTCOME_UNKNOWN'
        }
        const saved = await rpc(
          'finish_flw_delivery',
          { tenant, delivery: item.delivery_id, lease: item.lease, outcome },
          true
        )
        // Somente campos permitidos: nunca corpo/resposta brutos ou exceções.
        log({
          tenant_id: tenant,
          event_id: item.event_id,
          correlation_id: item.correlation_id,
          code: saved ? outcome : 'OUTCOME_UNKNOWN',
          simulated: true
        })
        processed++
      }
      return reply(200, { code: 'SIMULATION_ONLY', processed })
    } catch {
      log({
        tenant_id: tenant,
        action,
        code: 'INTEGRATION_UNAVAILABLE',
        ...context
      })
      return reply(503, { code: 'INTEGRATION_UNAVAILABLE', tenant_id: tenant })
    }
  }
}
