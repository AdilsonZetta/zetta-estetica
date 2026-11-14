// Somente chave pública. Nunca aceitar chave privilegiada na configuração do navegador.
export function publicKey(value: string) {
  if (value.startsWith('sb_publishable_')) return true
  try {
    const segment = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, '='))).role === 'anon'
  } catch { return false }
}
