// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  // 1 retry on CI to handle worker cold-start flakiness (15-25s delays can exceed timeout).
  // No retries locally — a failing test should be visible immediately.
  retries: process.env.CI ? 1 : 0,
  // Stop the whole run on the first failure so CI gives immediate feedback.
  // In local runs there is no limit (run everything to see all issues at once).
  maxFailures: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'off',
  },
  webServer: {
    command: 'npx serve . -l 3000 --no-port-switching',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './tests/fixtures/playwright-global-setup.js',
  globalTeardown: './tests/fixtures/playwright-global-teardown.js',
});
