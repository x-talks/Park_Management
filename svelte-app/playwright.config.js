// playwright.config.js — Svelte app E2E config
// Runs against the built SvelteKit static output (vite preview).
// The build is triggered here so VITE_ env vars can be injected from STAGING_* vars.
import { defineConfig, devices } from '@playwright/test';

// Map STAGING_* → VITE_* so vite build picks up the staging endpoints.
const stagingEnv = {
  VITE_SUPABASE_URL: process.env.STAGING_SUPABASE_URL ?? '',
  VITE_SUPABASE_ANON_KEY: process.env.STAGING_SUPABASE_ANON_KEY ?? '',
  VITE_WORKER_URL: process.env.STAGING_WORKER_URL ?? '',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'off',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
    env: stagingEnv,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: '../tests/fixtures/playwright-global-setup.js',
  globalTeardown: '../tests/fixtures/playwright-global-teardown.js',
});
