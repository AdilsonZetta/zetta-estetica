import { defineConfig, devices } from '@playwright/test'
// @ts-expect-error módulo de suporte Node, não empacotado pelo Vite
import { localConfig, localStackAvailable } from './tests/local-auth.mjs'

const local = localStackAvailable() ? localConfig() : null
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { trace: 'off', screenshot: 'off' },
  webServer: [
    { command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 42730 --strictPort', url: 'http://127.0.0.1:42730/zetta-estetica/integration-lab', reuseExistingServer: !process.env.CI, env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_FLW_RETURN_URL: '' } },
    ...(local ? [{ command: 'npm run dev -- --host 127.0.0.1 --port 42731 --strictPort', url: 'http://127.0.0.1:42731/zetta-estetica/integration-lab', reuseExistingServer: !process.env.CI, env: { VITE_SUPABASE_URL: local.url, VITE_SUPABASE_ANON_KEY: local.anon, VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_FLW_RETURN_URL: 'https://flw.example.invalid/conta' } }] : []),
  ],
  projects: [
    { name: 'desktop', testMatch: ['lab.spec.ts', 'shell-offline.spec.ts'], use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:42730' } },
    { name: 'mobile-chromium', testMatch: ['lab.spec.ts', 'shell-offline.spec.ts'], use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:42730' } },
    ...(local ? [{ name: 'auth-local', testMatch: ['auth.spec.ts', 'shell.spec.ts'], use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:42731' } },
    { name: 'auth-mobile-chromium', testMatch: ['auth.spec.ts', 'shell.spec.ts'], use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:42731' } }] : []),
  ],
})
