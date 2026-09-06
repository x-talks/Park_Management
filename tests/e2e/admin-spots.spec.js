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
    // State chip for reserved spots has class "chip inactive" and shows "Extern"
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
    await expect(s3Row).toBeVisible({ timeout: 10_000 });
    await expect(s3Row.locator('.chip.inactive')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Reserve/unreserve toggle', () => {
  test('reserved spot can be unreserved and then re-reserved (toggle)', async ({ page }) => {
    // s3 is reserved in staging — locate it by its label "3"
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
    await expect(s3Row).toBeVisible({ timeout: 10_000 });

    // Step 1: ensure spot starts reserved — if already free, re-reserve via assign dropdown
    const alreadyFree = await s3Row.locator('.chip.free').count();
    if (alreadyFree > 0) {
      const asgSel = s3Row.locator('select').first();
      await asgSel.selectOption('__extern__');
      await page.locator('#pm-modal-confirm').click();
      await page.waitForTimeout(1500);
      await expect(s3Row.locator('.chip.inactive')).toBeVisible({ timeout: 5_000 });
    }

    // Now click Unreserve button
    const unreserveBtn = s3Row.locator('button[title="Unreserve"]').first();
    await expect(unreserveBtn).toBeVisible({ timeout: 5_000 });
    await unreserveBtn.click();
    await page.waitForTimeout(1500);

    // After unreserving, reserved chip gone; Free chip visible
    await expect(s3Row.locator('.chip.inactive')).not.toBeVisible({ timeout: 5_000 });
    await expect(s3Row.locator('.chip.free')).toBeVisible({ timeout: 5_000 });

    // Step 2: re-reserve via assign dropdown (select "Extern" option)
    const asgSel = s3Row.locator('select').first();
    await asgSel.selectOption('__extern__');
    // Confirm the modal
    await page.locator('#pm-modal-confirm').click();
    await page.waitForTimeout(1500);

    // Spot should be reserved again — reserved chip back
    await expect(s3Row.locator('.chip.inactive')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Rent editing', () => {
  test('change rent on s1 to 95 → value saved', async ({ page }) => {
    // s1 has plate HD-AA-001 — use that to identify the row
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    // Click Edit to enter edit mode — rent input only exists in edit mode
    await s1Row.locator('button[title="Edit"]').first().click();
    const rentInput = s1Row.locator('input[type="number"]').first();
    await expect(rentInput).toBeVisible({ timeout: 5_000 });
    await rentInput.fill('95');
    // Save via Save button (💾)
    await s1Row.locator('button[title="Save"]').first().click();
    await page.waitForTimeout(1500);
    // Re-enter edit mode to verify the saved value
    await s1Row.locator('button[title="Edit"]').first().click();
    const rentInputAfter = s1Row.locator('input[type="number"]').first();
    await expect(rentInputAfter).toHaveValue('95');
    // Cancel edit to leave table clean
    await s1Row.locator('button[title="Cancel"]').first().click();
  });
});
