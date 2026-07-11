// tests/e2e/admin-payments.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 30_000 });
  // Do NOT use waitForLoadState('networkidle') — loadPendingRegistrations() blocks it in CI.
  await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
  // Click payments tab: id=tab-btn-payments
  await page.locator('#tab-btn-payments').click();
  await expect(page.locator('#payment-year')).toBeVisible({ timeout: 30_000 });
});

test.describe('Payments table', () => {
  test('3 rows — one per assigned spot (s1, s2, s6)', async ({ page }) => {
    // Payments rendered in #payment-matrix — 3 occupied spots: s1, s2, s6
    const rows = page.locator('#payment-matrix table tr');
    await expect(rows.nth(1)).toBeVisible({ timeout: 10_000 });
    await expect(rows).toHaveCount(4); // 1 header + 3 data rows
  });

  test('s1 row has a paid indicator (✓)', async ({ page }) => {
    const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 1' }).first();
    await expect(s1Row).toContainText('✓');
  });

  test('year selector is visible', async ({ page }) => {
    // Year selector id=payment-year
    await expect(page.locator('#payment-year')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('CSV export', () => {
  test('CSV export triggers a file download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      page.locator('#csv-export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });
});
