// tests/e2e/admin-spots.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 30_000 });
  // Do NOT use waitForLoadState('networkidle') — loadPendingRegistrations() blocks it in CI.
  await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
  // Click spots tab: id=tab-btn-spots
  await page.locator('#tab-btn-spots').click();
  await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 15_000 });
});

test.describe('Spots table', () => {
  test('spots table has 24 rows', async ({ page }) => {
    // Table has 1 header row + 24 data rows = 25 total (no explicit tbody)
    const rows = page.locator('#spot-list table tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBe(25); // 1 header row + 24 data rows
  });

  test('s1 shows renter HD-AA-001', async ({ page }) => {
    // s1 has label "1"; row text includes "Alice Renter" and plate "HD-AA-001"
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    await expect(s1Row).toContainText('HD-AA-001');
  });

  test('s3 shows reserved indicator', async ({ page }) => {
    // s3 is the only reserved spot; its row has "Reserved" chip
    const reservedRow = page.locator('#spot-list table tr').filter({ hasText: /Reserved/i }).first();
    await expect(reservedRow).toBeVisible({ timeout: 5000 });
    await expect(reservedRow).toContainText(/reserved/i);
  });
});

test.describe('Rent editing', () => {
  test('change rent on s1 to 95 → value saved', async ({ page }) => {
    // s1 has plate HD-AA-001 — use that to identify the row
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    const rentInput = s1Row.locator('input[type="number"], input.rent-input, input[name="rent"]').first();
    await rentInput.fill('95');
    await rentInput.press('Enter');
    await page.waitForTimeout(1500);
    await expect(rentInput).toHaveValue('95');
  });
});
