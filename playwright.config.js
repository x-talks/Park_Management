// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

// Mutation specs share staging DB rows — they must run serially and in a fixed order.
// Read-heavy specs only read data or use isolated rows — they can run in parallel.
const MUTATION_SPECS = [
  'tests/e2e/acceptance-admin.spec.js',
  'tests/e2e/admin-mutations.spec.js',
  'tests/e2e/admin-payments-mutations.spec.js',
  'tests/e2e/sync.spec.js',
];

export default defineConfig({
  testDir: './tests/e2e',
  retries: process.env.CI ? 1 : 0,
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
      // Serial project: mutation specs that share DB rows — run one at a time, fixed order.
      name: 'serial',
      testMatch: MUTATION_SPECS,
      fullyParallel: false,
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Parallel project: read-heavy specs — 2 workers on CI (2-core runner), 4 locally.
      name: 'parallel',
      testIgnore: MUTATION_SPECS,
      fullyParallel: true,
      workers: process.env.CI ? 2 : 4,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './tests/fixtures/playwright-global-setup.js',
  globalTeardown: './tests/fixtures/playwright-global-teardown.js',
});
