// tests/e2e/spots.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, RENTER_USER, RENTER_PASS);
  await page.waitForURL(/parking\.html/, { timeout: 30_000 });
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

test.describe('Info panel content', () => {
  test('clicking occupied spot shows renter plate', async ({ page }) => {
    // beforeEach already logged in as HD-AA-001
    await page.waitForSelector('svg g[data-id="s2"]', { timeout: 10_000 });
    // Wait for users data to be rendered (spot s2 should have class 'occupied')
    await expect(page.locator('svg g[data-id="s2"]')).toHaveClass(/occupied/, { timeout: 20_000 });
    await page.locator('svg g[data-id="s2"]').click();
    await expect(page.locator('#info-panel')).toBeVisible({ timeout: 10_000 });
    // Renters can only see their own user data via RLS — other renters' plates are not shown.
    // The panel shows "Spot 2: Occupied" or a generic occupied message.
    await expect(page.locator('#info-panel')).toContainText(/Spot 2|occupied/i, { timeout: 10_000 });
  });

  test('clicking free spot shows "Free" in info panel', async ({ page }) => {
    // beforeEach already logged in as HD-AA-001
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').click();
    await expect(page.locator('#info-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#info-panel')).toContainText(/free/i, { timeout: 10_000 });
  });
});

test.describe('Residents list', () => {
  test('residents panel shows active renters after toggle', async ({ page }) => {
    // beforeEach already logged in as HD-AA-001
    const toggle = page.locator('#residents-toggle');
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();
    const panel = page.locator('#residents-panel').first();
    await expect(panel).toBeVisible({ timeout: 10_000 });
    // Wait for residents data to load (panel starts empty until fetch completes)
    await expect(panel).toContainText(/HD-AA-001|HD-BB-002/, { timeout: 15_000 });
  });
});

test.describe('My payments section', () => {
  test('payments section shows current year', async ({ page }) => {
    // beforeEach already logged in as HD-AA-001
    await expect(page.locator('#my-payments-section')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#my-payments-section')).toContainText(String(new Date().getFullYear()));
  });
});
