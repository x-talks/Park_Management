// tests/e2e/spots.spec.js
import { test, expect } from './fixtures.js';
import { loginAs, waitForAppReady } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';
const ADMIN_USER  = 'TEST-ADMIN';
const ADMIN_PASS  = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.describe('Map rendering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
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

test.describe('Bottom sheet — Bug 2 fix: starts hidden, no idle peek', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('bottom sheet is NOT open on initial page load', async ({ page }) => {
    // Sheet must start fully hidden — no peek, not overlapping legend
    await expect(page.locator('#spot-sheet')).not.toHaveClass(/open/);
  });

  test('clicking a free spot (s5) opens the bottom sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').first().click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });
  });

  test('closing the sheet via backdrop removes open class', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').first().click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });
    await page.locator('#sheet-backdrop').click();
    await expect(page.locator('#spot-sheet')).not.toHaveClass(/open/, { timeout: 5_000 });
  });

  test('bottom sheet for own spot (s1) contains renter plate', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s1"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s1"]').first().click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });
    await expect(page.locator('#sheet-content')).toContainText('HD-AA-001');
  });
});

test.describe('Bottom sheet content', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('clicking occupied spot shows occupied status in sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s2"]', { timeout: 10_000 });
    await expect(page.locator('svg g[data-id="s2"]')).toHaveClass(/occupied/, { timeout: 20_000 });
    await page.locator('svg g[data-id="s2"]').click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 10_000 });
    await expect(page.locator('#sheet-content')).toContainText(/Spot 2|occupied/i, { timeout: 10_000 });
  });

  test('clicking free spot shows "Free" status in sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 10_000 });
    await expect(page.locator('#sheet-content')).toContainText(/free/i, { timeout: 10_000 });
  });
});

test.describe('My payments section', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('payments section shows current year', async ({ page }) => {
    await expect(page.locator('#my-payments-section')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#my-payments-section')).toContainText(String(new Date().getFullYear()));
  });
});

test.describe('Admin map assign — Bug 1 fix: assign/release via new routes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/admin\.html/, { timeout: 30_000 });
    await page.goto('/parking.html');
    await page.waitForURL(/parking\.html/, { timeout: 10_000 });
    await waitForAppReady(page, 'renter');
  });

  test('admin can open sheet for a free spot and sees Assign button', async ({ page }) => {
    // Find a spot without an assigned user (free or pending)
    await page.waitForSelector('svg g.free, svg g.pending', { timeout: 15_000 });
    const freeSpot = page.locator('svg g.free, svg g.pending').first();
    await freeSpot.click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });
    // Admin sheet must contain an Assign button (not shown to renters)
    await expect(page.locator('#sheet-content button, #sheet-content [data-action]')
      .filter({ hasText: /assign/i })).toBeVisible({ timeout: 5_000 });
  });

  test('admin assign renter to free spot — no error toast', async ({ page }) => {
    // Use s5 (free, no renter). Open sheet.
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    const spot = page.locator('svg g[data-id="s5"]').first();
    const cls = await spot.getAttribute('class');
    if (!cls || !cls.includes('free')) {
      // Spot may already be occupied from a prior test run — skip gracefully
      test.skip(true, 's5 not free, skipping assign test');
    }
    await spot.click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });

    const assignBtn = page.locator('#sheet-content').getByRole('button', { name: /assign/i });
    await expect(assignBtn).toBeVisible({ timeout: 5_000 });
    await assignBtn.click();

    // Assign modal should appear with a user select
    await expect(page.locator('#assign-modal, [id*="assign"]').first()).toBeVisible({ timeout: 5_000 });

    // Pick first available renter from select
    const userSelect = page.locator('select[id*="assign-user"], #assign-user-select, select').last();
    await userSelect.selectOption({ index: 1 });

    const confirmBtn = page.locator('button').filter({ hasText: /confirm|assign/i }).last();
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    // No error toast
    await expect(page.locator('.toast-error, [class*="toast"][class*="error"]')).not.toBeVisible({ timeout: 3_000 });
  });
});
