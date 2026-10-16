import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright para os testes e2e ONLINE (backend real).
 *
 * Diferente da config offline, esta aponta para um projeto Supabase a sério e
 * ativa o login de teste (email/password) via `NEXT_PUBLIC_E2E_AUTH=1`.
 *
 * Credenciais NUNCA são commitadas: vivem em `.env.e2e` (ignorado pelo git).
 * Corre com: `bun run e2e:online`.
 */

// Carrega `.env.e2e` (parser mínimo, sem dependências) antes de definir a config.
const envFile = resolve(process.cwd(), '.env.e2e');
if (existsSync(envFile)) {
  for (const raw of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e/online',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  timeout: 150_000,
  expect: { timeout: 20_000 },
  globalSetup: './e2e/online/global-setup.ts',
  globalTeardown: './e2e/online/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-online', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? '',
      NEXT_PUBLIC_E2E_AUTH: '1',
    },
  },
});
