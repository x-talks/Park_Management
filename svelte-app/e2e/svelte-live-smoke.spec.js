import { test, expect } from '@playwright/test';

const BASE = 'https://x-talks.github.io/Park_Management/svelte';

// Test 1: all routes load correctly (200, not bounced to domain root)
const ROUTES = ['/', '/parking', '/admin', '/incident', '/profile'];
for (const route of ROUTES) {
  test(`route ${route} stays within /svelte/`, async ({ page }) => {
    await page.goto(BASE + route);
    await page.waitForURL('**/Park_Management/svelte**', { timeout: 15_000 });
    expect(page.url()).toContain('/Park_Management/svelte');
  });
}

// Test 2: nav links on the parking page point to correct base-prefixed URLs
test('parking page nav links use /Park_Management/svelte/ base', async ({ page }) => {
  await page.goto(BASE + '/parking');
  await page.waitForLoadState('networkidle');
  // The bottom nav should have links with the correct base
  const hrefs = await page.locator('nav a').evaluateAll(els =>
    els.map(el => el.getAttribute('href'))
  );
  console.log('Nav hrefs:', hrefs);
  // Every link must start with /Park_Management/svelte
  for (const href of hrefs) {
    if (href) expect(href).toMatch(/^\/Park_Management\/svelte/);
  }
});

// Test 3: isAuthPage check — login page must NOT show bottom nav
test('login page does not show bottom nav', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.waitForLoadState('networkidle');
  const nav = page.locator('[data-testid="bottom-nav"]');
  await expect(nav).not.toBeVisible();
});
