// tests/e2e/admin-spots.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  // Click spots tab: id=tab-btn-spots
  await page.locator('#tab-btn-spots').click();
  await page.waitForTimeout(1000);
});

test.describe('Spots table', () => {
  test('spots table has 24 rows', async ({ page }) => {
    // Spots rendered in #spot-list > .table-wrap > table
    const rows = page.locator('#spot-list table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBe(24);
  });

  test('s1 shows renter HD-AA-001', async ({ page }) => {
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: /\bs1\b/ }).first();
    await expect(s1Row).toContainText('HD-AA-001');
  });

  test('s3 shows reserved indicator', async ({ page }) => {
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /\bs3\b/ }).first();
    // Reserved badge/chip
    await expect(s3Row).toContainText(/reserved|Reserv/i);
  });
});

test.describe('Rent editing', () => {
  test('change rent on s1 to 95 → value saved', async ({ page }) => {
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: /\bs1\b/ }).first();
    const rentInput = s1Row.locator('input[type="number"], input.rent-input, input[name="rent"]').first();
    await rentInput.fill('95');
    await rentInput.press('Enter');
    await page.waitForTimeout(1500);
    await expect(rentInput).toHaveValue('95');
  });
});
