import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Laboratório do Discovery preservado como entrada independente.
export default defineConfig({
  base: '/zetta-estetica/',
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { input: { main: 'index.html', lab: 'integration-lab/index.html' } } },
})
