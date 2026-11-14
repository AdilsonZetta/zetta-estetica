import type { Context, Outcome, Ports } from './contract.ts'
import { flwFixture } from '../../../fixtures/simulacao/flw.ts'
export const capabilityUnavailable = Object.freeze({
  code: 'CAPABILITY_NOT_VERIFIED',
  manual: true
})
// Sem URL base, autenticação ou endpoints presumidos. Cofre só será lido por transporte homologado.
const simulated = (context: Context): Promise<Outcome> => {
  if (!context.simulated) throw new Error(capabilityUnavailable.code)
  return Promise.resolve(flwFixture.code)
}
export const simulationPorts: Ports = {
  contact: { lookup: simulated },
  card: { update: simulated },
  charge: { create: simulated },
  automation: { trigger: simulated }
}
export async function bounded<T>(
  work: Promise<T>,
  milliseconds: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('OUTCOME_UNKNOWN')),
          milliseconds
        )
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}
