// Todo recurso que sobreviva ao componente deve ser registrado aqui.
const previews = new Set<string>()
const cleanups = new Set<() => void>()
export function trackPreview(url: string) {
  previews.add(url)
  return url
}
export function releasePreview(url: string) {
  URL.revokeObjectURL(url)
  previews.delete(url)
}
export function registerContextCleanup(cleanup: () => void) {
  cleanups.add(cleanup)
  return () => {
    cleanups.delete(cleanup)
  }
}
export function clearTenantContext() {
  const pendingCleanups = [...cleanups]
  const pendingPreviews = [...previews]
  cleanups.clear()
  previews.clear()
  for (const cleanup of pendingCleanups) {
    try { cleanup() } catch { /* Uma falha não deve interromper a limpeza dos demais recursos. */ }
  }
  for (const url of pendingPreviews) URL.revokeObjectURL(url)
}
