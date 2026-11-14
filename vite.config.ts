import { defineConfig } from 'vite'

// Prova isolada. A aplicação React será criada no Prompt 01.
export default defineConfig({
  base: '/zetta-estetica/',
  build: { rollupOptions: { input: { main: 'index.html', lab: 'integration-lab/index.html' } } },
})
