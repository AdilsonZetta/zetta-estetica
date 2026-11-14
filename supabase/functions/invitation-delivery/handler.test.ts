import { deliveryHandler } from './handler.ts'
const config = {
  url: 'http://backend.invalid',
  publicKey: 'public-test',
  serviceKey: 'server-test',
  appUrl: 'https://app.invalid/zetta-estetica',
  allowedOrigin: 'https://app.invalid'
}
const invitation = '10000000-0000-0000-0000-000000000099'
const req = () =>
  new Request('http://edge.invalid', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-test' },
    body: JSON.stringify({ invitation })
  })
function assert(value: unknown) {
  if (!value) throw new Error('Assertiva falhou')
}
Deno.test('Edge recusa sessão ausente sem acessar servidor', async () => {
  let calls = 0
  const handle = deliveryHandler(config, () => {
    calls++
    throw new Error('Não deveria chamar')
  })
  assert(
    (await handle(new Request('http://edge.invalid', { method: 'POST' })))
      .status === 401
  )
  assert(calls === 0)
})
Deno.test('Autorização recusada não usa chave privilegiada', async () => {
  const calls: string[] = []
  const handle = deliveryHandler(config, (_url, init) => {
    calls.push(new Headers(init?.headers).get('authorization')!)
    return Promise.resolve(new Response('{}', { status: 403 }))
  })
  assert((await handle(req())).status === 403)
  assert(calls.join() === 'Bearer user-test')
})
Deno.test(
  'Falha Auth registra estado recuperável e redige mensagem sensível',
  async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    const handle = deliveryHandler(config, (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      if (String(url).includes('/auth/v1/'))
        return Promise.resolve(
          new Response('segredo do provedor', { status: 500 })
        )
      const result = String(url).includes('request_')
        ? 'pending'
        : String(url).includes('claim_')
          ? { email: 'sintetico@example.com', lease: 'lease-test' }
          : null
      return Promise.resolve(Response.json(result))
    })
    const response = await handle(req())
    assert(response.status === 502)
    assert(!(await response.text()).includes('segredo'))
    assert(calls[3].body.success === false)
    assert(
      calls[2].url.includes(
        encodeURIComponent(config.appUrl + '/convites/' + invitation)
      )
    )
  }
)
Deno.test('Retry de envio concluído não chama Auth novamente', async () => {
  let calls = 0
  const handle = deliveryHandler(config, () => {
    calls++
    return Promise.resolve(Response.json('sent'))
  })
  assert((await handle(req())).status === 200)
  assert(calls === 1)
})
Deno.test(
  'Lease ocupado e origem inválida bloqueiam envio duplicado',
  async () => {
    let calls = 0
    const handle = deliveryHandler(config, () =>
      Promise.resolve(Response.json(++calls === 1 ? 'sending' : null))
    )
    assert((await handle(req())).status === 409)
    assert(calls === 2)
    assert(
      (
        await handle(
          new Request('http://edge.invalid', {
            method: 'POST',
            headers: { Origin: 'https://evil.invalid' }
          })
        )
      ).status === 403
    )
  }
)

Deno.test(
  'Origem ausente na configuração retorna 503 antes de CORS e transporte',
  async () => {
    let calls = 0
    const handle = deliveryHandler({ ...config, allowedOrigin: '' }, () => {
      calls++
      throw new Error('Não deveria chamar')
    })
    for (const method of ['POST', 'OPTIONS']) {
      const response = await handle(
        new Request('http://edge.invalid', {
          method,
          headers: { Origin: config.allowedOrigin }
        })
      )
      assert(response.status === 503)
      assert((await response.json()).code === 'SERVER_NOT_CONFIGURED')
    }
    assert(calls === 0)
  }
)

Deno.test(
  'URL do backend com barra final não duplica separadores',
  async () => {
    const handle = deliveryHandler(
      { ...config, url: config.url + '/' },
      (url) => {
        assert(
          String(url) ===
            config.url + '/rest/v1/rpc/request_invitation_delivery'
        )
        return Promise.resolve(Response.json('sent'))
      }
    )
    assert((await handle(req())).status === 200)
  }
)
