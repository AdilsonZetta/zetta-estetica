// Contrato Zetta v1: IDs internos. Nenhum telefone, mensagem ou token na fila.
export type Operation =
  | 'contact.lookup'
  | 'card.update'
  | 'charge.create'
  | 'automation.trigger'
export type Context = {
  tenant_id: string
  event_id: string
  correlation_id: string
  simulated: boolean
}
export type Outcome =
  | 'SIMULATED_SUCCESS'
  | 'RATE_LIMITED'
  | 'CREDENTIAL_EXPIRED'
  | 'OUTCOME_UNKNOWN'
  | 'PERMANENT_FAILURE'
export interface ContactPort {
  lookup(context: Context): Promise<Outcome>
}
export interface CardPort {
  update(context: Context): Promise<Outcome>
}
export interface ChargePort {
  create(context: Context): Promise<Outcome>
}
export interface AutomationPort {
  trigger(context: Context): Promise<Outcome>
}
export type Ports = {
  contact: ContactPort
  card: CardPort
  charge: ChargePort
  automation: AutomationPort
}
export function route(
  ports: Ports,
  operation: Operation,
  context: Context
): Promise<Outcome> {
  switch (operation) {
    case 'contact.lookup':
      return ports.contact.lookup(context)
    case 'card.update':
      return ports.card.update(context)
    case 'charge.create':
      return ports.charge.create(context)
    case 'automation.trigger':
      return ports.automation.trigger(context)
    default:
      return Promise.resolve('PERMANENT_FAILURE')
  }
}
