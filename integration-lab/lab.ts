import { clinics } from '../fixtures/simulacao/clinics.ts'

export function resolveClinic(search: string) {
  const slug = new URLSearchParams(search).get('clinic')
  return slug ? clinics.find(clinic => clinic.slug === slug) ?? null : clinics[0]
}

// Destino de retorno vem exclusivamente da configuração do ambiente.
export function approvedReturnUrl(value: string | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? url.href : null
  } catch { return null }
}

export function isPublicKey(key: string) {
  if (key.startsWith('sb_publishable_')) return true
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'anon'
  } catch { return false }
}

export function capabilityResult() {
  return { simulated: true, code: 'CAPABILITY_NOT_VERIFIED', message: 'Operação FLW pendente de homologação. Execute a tarefa manual na conta correta.' } as const
}

export function proofUrl(origin: string, base: string, slug: string) {
  const url = new URL(`${base}integration-lab`, origin)
  url.searchParams.set('clinic', slug)
  return url.href
}
