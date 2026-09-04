// e2e/spots.spec.js
import { test, expect } from './fixtures.js';
import { loginAs, waitForAppReady } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';
const ADMIN_USER  = 'TEST-ADMIN';
const ADMIN_PASS  = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.describe('Map rendering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/\/parking/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('parking map has 24 spot elements', async ({ page }) => {
    const spots = page.locator('svg g.spot, svg g[data-id]');
    await expect(spots.first()).toBeVisible({ timeout: 10_000 });
    const count = await spots.count();
    expect(count).toBeGreaterThanOrEqual(24);
  });

  test('spot s3 (reserved) has reserved CSS class', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s3"]', { timeout: 10_000 });
    const cls = await page.locator('svg g[data-id="s3"]').first().getAttribute('class');
    expect(cls).toContain('reserved');
  });
});

test.describe('Bottom sheet — starts hidden, no idle peek', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/\/parking/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('bottom sheet is NOT open on initial page load', async ({ page }) => {
    await expect(page.locator('#spot-sheet')).not.toBeVisible();
  });

  test('clicking a free spot (s5) opens the bottom sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').first().click();
    await expect(page.locator('#spot-sheet')).toBeVisible({ timeout: 5_000 });
  });

  test('closing the sheet via backdrop removes it', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').first().click();
    await expect(page.locator('#spot-sheet')).toBeVisible({ timeout: 5_000 });
    await page.locator('.sheet-backdrop').click();
    await expect(page.locator('#spot-sheet')).not.toBeVisible({ timeout: 5_000 });
  });

  test('bottom sheet for own spot (s1) contains renter plate', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s1"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s1"]').first().click();
    await expect(page.locator('#spot-sheet')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#sheet-content')).toContainText('HD-AA-001');
  });
});

test.describe('Bottom sheet content', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/\/parking/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('clicking occupied spot shows occupied status in sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s2"]', { timeout: 10_000 });
    await expect(page.locator('svg g[data-id="s2"]')).toHaveClass(/occupied/, { timeout: 20_000 });
    await page.locator('svg g[data-id="s2"]').click();
    await expect(page.locator('#spot-sheet')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#sheet-content')).toContainText(/Spot 2|occupied/i, { timeout: 10_000 });
  });

  test('clicking free spot shows "Free" status in sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').click();
    await expect(page.locator('#spot-sheet')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#sheet-content')).toContainText(/free/i, { timeout: 10_000 });
  });
});

test.describe('My payments section', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/\/parking/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('payments section shows current year', async ({ page }) => {
    await expect(page.locator('#my-payments-section')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#my-payments-section')).toContainText(String(new Date().getFullYear()));
  });
});

test.describe('Admin map assign', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/\/parking/, { timeout: 30_000 });
    await waitForAppReady(page, 'admin');
  });

  test('admin can open sheet for a free spot and sees Assign button', async ({ page }) => {
    await page.waitForSelector('svg g.free, svg g.pending', { timeout: 15_000 });
    const freeSpot = page.locator('svg g.free, svg g.pending').first();
    await freeSpot.click();
    await expect(page.locator('#spot-sheet')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#sheet-content button, #sheet-content [data-action]')
      .filter({ hasText: /assign/i })).toBeVisible({ timeout: 5_000 });
  });
});
