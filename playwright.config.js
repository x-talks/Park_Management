// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  // Fail-fast: stop the whole run after N failures (after retries are exhausted).
  // Default 0 = no limit (a healthy run validates everything). Set MAX_FAILURES=1
  // in CI while stabilizing to get fast red feedback instead of waiting for all tests.
  maxFailures: process.env.MAX_FAILURES ? Number(process.env.MAX_FAILURES) : 0,
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
