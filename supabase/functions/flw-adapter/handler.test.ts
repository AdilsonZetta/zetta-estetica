import { flwHandler } from './handler.ts'
import { route, type Ports, type Outcome } from './contract.ts'
import { bounded, simulationPorts } from './transport.ts'
import { webhookHandler } from '../flw-webhook/handler.ts'
const tenant = '10000000-0000-0000-0000-000000000001',
  unit = '10000000-0000-0000-0000-000000000011'
const context = {
  tenant_id: tenant,
  event_id: tenant,
  correlation_id: tenant,
  simulated: true
}
const config = {
  url: 'http://localhost:54321',
  publicKey: 'public',
  serviceKey: 'secret-canary',
  origin: 'http://localhost:5173'
}
function assert(value: unknown): asserts value {
  if (!value) throw new Error('Assertiva falhou')
}
const request = (body: object, authorization = 'Bearer session') =>
  new Request('http://localhost/functions/v1/flw-adapter', {
    method: 'POST',
    headers: { authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant, unit, action: 'work', ...body })
  })
Deno.test('Contrato roteia contato, card, cobrança e automação', async () => {
  const calls: string[] = []
  const call = (op: string) => async () => {
    calls.push(op)
    return 'SIMULATED_SUCCESS' as const
  }
  const ports: Ports = {
    contact: { lookup: call('contact') },
    card: { update: call('card') },
    charge: { create: call('charge') },
    automation: { trigger: call('automation') }
  }
  for (const op of [
    'contact.lookup',
    'card.update',
    'charge.create',
    'automation.trigger'
  ] as const)
    await route(ports, op, context)
  assert(calls.join(',') === 'contact,card,charge,automation')
})
Deno.test('Simulação explícita não aceita contexto real', async () => {
  assert(
    (await route(simulationPorts, 'charge.create', context)) ===
      'SIMULATED_SUCCESS'
  )
  let blocked = false
  try {
    await route(simulationPorts, 'charge.create', {
      ...context,
      simulated: false
    })
  } catch {
    blocked = true
  }
  assert(blocked)
})
Deno.test('Webhook não comprovado recusa sem persistir', () => {
  assert(webhookHandler().status === 501)
})
Deno.test(
  'Sessão ausente, origem, método e contrato inválido não usam transporte',
  async () => {
    const h = flwHandler(config, () => {
      throw new Error('Não chamar')
    })
    assert((await h(request({}, ''))).status === 401)
    assert((await h(request({ tenant: 'slug' }))).status === 400)
    assert(
      (await h(new Request('http://localhost', { method: 'GET' }))).status ===
        405
    )
    assert(
      (
        await h(
          new Request('http://localhost', {
            method: 'POST',
            headers: { origin: 'https://evil.invalid' }
          })
        )
      ).status === 403
    )
    assert(
      (await h(request({ action: 'request', simulation: 'true' }))).status ===
        400
    )
  }
)
Deno.test(
  'Autoridade negada impede uso da chave de serviço e erro é redigido',
  async () => {
    let calls = 0
    const h = flwHandler(config, async (_url, init) => {
      calls++
      assert(new Headers(init?.headers).get('apikey') === 'public')
      return new Response('token-privado', { status: 403 })
    })
    const r = await h(request({}))
    const raw = await r.text()
    assert(
      r.status === 503 &&
        calls === 1 &&
        !raw.includes('token-privado') &&
        raw.includes(tenant)
    )
  }
)
for (const outcome of [
  'RATE_LIMITED',
  'CREDENTIAL_EXPIRED',
  'OUTCOME_UNKNOWN',
  'SIMULATED_SUCCESS',
  'PERMANENT_FAILURE'
] as Outcome[]) {
  Deno.test(
    `Worker registra ${outcome}, propaga sessão e contexto, sem logs privados`,
    async () => {
      let calls = 0
      const logs: object[] = []
      const port = async (c: typeof context) => {
        assert(c.tenant_id === tenant && c.correlation_id === tenant)
        return outcome
      }
      const ports: Ports = {
        contact: { lookup: port },
        card: { update: port },
        charge: { create: port },
        automation: { trigger: port }
      }
      const h = flwHandler(
        config,
        async (url, init) => {
          calls++
          const headers = new Headers(init?.headers)
          if (calls === 1) {
            assert(headers.get('Authorization') === 'Bearer session')
            return Response.json([
              { delivery_id: tenant, state: 'pending', simulated: true }
            ])
          }
          assert(headers.get('apikey') === 'secret-canary')
          if (String(url).endsWith('claim_flw_delivery'))
            return Response.json({
              ...context,
              delivery_id: tenant,
              lease: tenant,
              operation: 'charge.create'
            })
          assert(JSON.parse(String(init?.body)).outcome === outcome)
          return Response.json(true)
        },
        ports,
        (e) => logs.push(e)
      )
      assert((await h(request({}))).status === 200 && calls === 3)
      assert(
        logs.length === 1 && !JSON.stringify(logs).includes('secret-canary')
      )
    }
  )
}
Deno.test('Interrupção do transporte vira resultado desconhecido', async () => {
  let outcome = ''
  let call = 0
  const fail = () => Promise.reject(new Error('token privado'))
  const h = flwHandler(
    config,
    async (_url, init) => {
      call++
      if (call === 1)
        return Response.json([
          { delivery_id: tenant, state: 'pending', simulated: true }
        ])
      if (call === 2)
        return Response.json({
          ...context,
          delivery_id: tenant,
          lease: tenant,
          operation: 'contact.lookup'
        })
      outcome = JSON.parse(String(init?.body)).outcome
      return Response.json(true)
    },
    {
      contact: { lookup: fail },
      card: { update: fail },
      charge: { create: fail },
      automation: { trigger: fail }
    },
    () => {}
  )
  await h(request({}))
  assert(outcome === 'OUTCOME_UNKNOWN')
})
Deno.test('Timeout limitado rejeita operação pendente', async () => {
  let timed = false
  try {
    await bounded(new Promise(() => {}), 5)
  } catch {
    timed = true
  }
  assert(timed)
})
Deno.test(
  'Solicitação pendente encaminha somente JWT do usuário e retorna tarefa manual',
  async () => {
    const h = flwHandler(config, async (_url, init) => {
      assert(new Headers(init?.headers).get('apikey') === 'public')
      assert(JSON.parse(String(init?.body)).simulation === false)
      return Response.json({
        code: 'CAPABILITY_NOT_VERIFIED',
        state: 'manual'
      })
    })
    const r = await h(
      request({
        action: 'request',
        operation: 'charge.create',
        entity: tenant,
        correlation: tenant,
        version: 1
      })
    )
    assert((await r.json()).state === 'manual')
  }
)

for (const stage of [
  'request_flw_operation',
  'flw_work_candidates',
  'claim_flw_delivery',
  'finish_flw_delivery'
]) {
  Deno.test(
    `Falha em ${stage} gera log redigido com contexto disponível`,
    async () => {
      const logs: Record<string, unknown>[] = []
      const h = flwHandler(
        config,
        async (url) => {
          if (String(url).endsWith(stage))
            throw new Error('segredo-bruto-canary')
          if (String(url).endsWith('flw_work_candidates'))
            return Response.json([{ ...context, delivery_id: tenant }])
          return Response.json({
            ...context,
            delivery_id: tenant,
            lease: tenant,
            operation: 'contact.lookup'
          })
        },
        simulationPorts,
        (entry) => logs.push(entry as Record<string, unknown>)
      )
      const response = await h(
        request(
          stage === 'request_flw_operation'
            ? {
                action: 'request',
                operation: 'contact.lookup',
                entity: tenant,
                correlation: tenant,
                version: 1
              }
            : {}
        )
      )
      assert(response.status === 503 && logs.length === 1)
      assert(
        logs[0].tenant_id === tenant &&
          logs[0].code === 'INTEGRATION_UNAVAILABLE'
      )
      assert(
        logs[0].action ===
          (stage === 'request_flw_operation' ? 'request' : 'work')
      )
      if (stage === 'claim_flw_delivery' || stage === 'finish_flw_delivery') {
        assert(
          logs[0].event_id === tenant &&
            logs[0].correlation_id === tenant &&
            logs[0].simulated === true
        )
      }
      assert(!JSON.stringify(logs).includes('canary'))
      assert(!JSON.stringify(logs).includes('Bearer'))
    }
  )
}
