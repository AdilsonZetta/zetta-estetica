// Sem assinatura/origem/conta comprovadas: não lê corpo, não usa serviço, não grava inbox.
export function webhookHandler(): Response {
  return Response.json(
    { code: 'CAPABILITY_NOT_VERIFIED', manual: true },
    { status: 501 }
  )
}
