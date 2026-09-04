// playwright.config.js — Svelte app E2E config
// Runs against the built SvelteKit static output (vite preview).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: process.env.CI ? 1 : 0,
  timeout: 35_000,
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
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
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
