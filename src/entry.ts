// Preserva links do Discovery inclusive quando o host usa o fallback SPA
// para /integration-lab sem barra final. O restante pertence ao shell React.
const labPath = `${import.meta.env.BASE_URL}integration-lab`
if (location.pathname.replace(/\/$/, '') === labPath) {
  document.title = 'Laboratório de integração · Zetta Estética'
  void import('../integration-lab/main')
} else {
  void import('./main')
}
export {}
