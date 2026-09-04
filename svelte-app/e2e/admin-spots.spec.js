// e2e/admin-spots.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
  await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
  await page.locator('#tab-btn-spots').click();
  await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 15_000 });
});

test.describe('Spots table', () => {
  test('spots table has 24 rows', async ({ page }) => {
    const rows = page.locator('#spot-list table tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBe(25); // 1 header + 24 data rows
  });

  test('s1 shows renter HD-AA-001', async ({ page }) => {
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    await expect(s1Row).toContainText('HD-AA-001');
  });

  test('s3 shows reserved indicator', async ({ page }) => {
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
    await expect(s3Row).toBeVisible({ timeout: 10_000 });
    await expect(s3Row).toContainText(/reserved/i);
  });
});

test.describe('Reserve/unreserve toggle', () => {
  test('reserved spot can be unreserved and then re-reserved', async ({ page }) => {
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
    await expect(s3Row).toBeVisible({ timeout: 10_000 });

    const unreserveBtn = s3Row.locator('button[title="Unreserve"]').first();
    await expect(unreserveBtn).toBeVisible();
    await unreserveBtn.click();
    await page.waitForTimeout(1500);

    await expect(s3Row).not.toContainText(/reserved/i);

    const reserveBtn = s3Row.locator('button[title="Mark reserved"]').first();
    await expect(reserveBtn).toBeVisible({ timeout: 5_000 });
    await reserveBtn.click();
    await page.locator('#pm-modal-confirm').click();
    await page.waitForTimeout(1500);

    await expect(s3Row).toContainText(/reserved/i);
  });
});

test.describe('Rent editing', () => {
  test('change rent on s1 to 95 → value saved', async ({ page }) => {
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    const rentInput = s1Row.locator('input[type="number"], input.rent-inp, input[name="rent"]').first();
    await rentInput.fill('95');
    await rentInput.press('Enter');
    await page.waitForTimeout(1500);
    await expect(rentInput).toHaveValue('95');
  });
});
