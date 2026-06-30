// tests/e2e/spots.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, RENTER_USER, RENTER_PASS);
  await page.waitForURL(/parking\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
});

test.describe('Map rendering', () => {
  test('parking map has 24 spot elements', async ({ page }) => {
    // SVG spots are <g class="spot ..."> elements with data-id attribute
    const spots = page.locator('svg g.spot, svg g[data-id]');
    await expect(spots.first()).toBeVisible({ timeout: 10_000 });
    const count = await spots.count();
    expect(count).toBeGreaterThanOrEqual(24);
  });

  test('spot s3 (reserved) has reserved CSS class', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s3"]', { timeout: 10_000 });
    const spot = page.locator('svg g[data-id="s3"]').first();
    const cls = await spot.getAttribute('class');
    expect(cls).toContain('reserved');
  });
});

test.describe('Info panel', () => {
  test('clicking a free spot (s5) expands the info panel', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').first().click();
    await expect(page.locator('#info-panel').first()).toBeVisible({ timeout: 5_000 });
  });

  test('info panel for own spot (s1) contains renter plate', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s1"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s1"]').first().click();
    const panel = page.locator('#info-panel').first();
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await expect(panel).toContainText('HD-AA-001');
  });
});
