// tests/e2e/admin-payments.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  // Click payments tab: id=tab-btn-payments
  await page.locator('#tab-btn-payments').click();
  await expect(page.locator('#payment-year')).toBeVisible({ timeout: 15_000 });
});

test.describe('Payments table', () => {
  test('exactly 2 rows — one per assigned spot (s1 and s2)', async ({ page }) => {
    // Payments rendered in #payment-matrix
    const rows = page.locator('#payment-matrix table tr');
    await expect(rows.nth(1)).toBeVisible({ timeout: 10_000 });
    await expect(rows).toHaveCount(3); // 1 header + 2 data rows
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
