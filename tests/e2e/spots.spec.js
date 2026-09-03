// tests/e2e/spots.spec.js
import { test, expect } from './fixtures.js';
import { loginAs, waitForAppReady } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';
const ADMIN_USER  = 'TEST-ADMIN';
const ADMIN_PASS  = 'ParkManagement123!';

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
    const spot = page.locator('svg g[data-id="s3"]').first();
    const cls = await spot.getAttribute('class');
    expect(cls).toContain('reserved');
  });
});

test.describe('Bottom sheet', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('clicking a free spot (s5) opens the bottom sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').first().click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });
  });

  test('bottom sheet for own spot (s1) contains renter plate', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s1"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s1"]').first().click();
    const sheet = page.locator('#sheet-content');
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });
    await expect(sheet).toContainText('HD-AA-001');
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

test.describe('Admin — map assign modal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/parking\.html|admin\.html/, { timeout: 30_000 });
    // Admin lands on admin.html — navigate to map
    if (page.url().includes('admin.html')) {
      await page.goto(page.url().replace('admin.html', 'parking.html'));
    }
    await waitForAppReady(page, 'admin');
  });

  test('clicking free spot as admin shows Assign button in sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').first().click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });
    await expect(page.locator('#sheet-content button')).toContainText(/assign/i, { timeout: 5_000 });
  });

  test('Assign button opens renter list in sheet', async ({ page }) => {
    await page.waitForSelector('svg g[data-id="s5"]', { timeout: 10_000 });
    await page.locator('svg g[data-id="s5"]').first().click();
    await expect(page.locator('#spot-sheet')).toHaveClass(/open/, { timeout: 5_000 });
    const assignBtn = page.locator('#sheet-content button', { hasText: /assign/i });
    await assignBtn.click();
    // Sheet should now show renter list or "No unassigned renters" message
    await expect(page.locator('#sheet-content')).toContainText(/assign renter|no unassigned/i, { timeout: 5_000 });
  });
});

test.describe('Language switch — no logout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await waitForAppReady(page, 'renter');
  });

  test('switching language does not redirect to login', async ({ page }) => {
    // Switch to German
    await page.locator('button', { hasText: 'DE' }).click();
    await page.waitForTimeout(1000);
    // Should still be on parking.html, not index.html
    expect(page.url()).toMatch(/parking\.html/);
    // Page should still show the map
    await expect(page.locator('#parking-svg')).toBeVisible();
  });
});
