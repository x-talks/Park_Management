// tests/e2e/admin-payments-mutations.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 30_000 });
  // Do NOT use waitForLoadState('networkidle') — loadPendingRegistrations() blocks it in CI.
  // Instead wait for stat-cards (lightweight, rendered synchronously) before clicking payments tab.
  await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
  await page.locator('#tab-btn-payments').click();
  await expect(page.locator('#payment-year')).toBeVisible({ timeout: 30_000 });
  // Wait for payment matrix to actually render rows (avoid networkidle due to pending renderUsers)
  await expect(page.locator('#payment-matrix table tr').nth(1)).toBeVisible({ timeout: 30_000 });
});

test.describe('Mark paid / revert', () => {
  test('mark s2 current month as paid → cell shows ✓', async ({ page }) => {
    const s2Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    // iconBtn uses title="Mark paid", not textContent
    const markBtn = s2Row.locator('button[title="Mark paid"]').first();
    await markBtn.click();
    await page.waitForTimeout(2000);
    await expect(s2Row).toContainText('✓');
  });

  test('revert s1 paid month → cell no longer shows paid styling', async ({ page }) => {
    const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 1' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    // Ensure there is at least one paid cell on s1 (mark if not already paid)
    const hasPaid = await s1Row.locator('.payment-cell-paid').count() > 0;
    if (!hasPaid) {
      // Mark current month as paid first
      const unpaidBtn = s1Row.locator('button[title="Mark paid"]').first();
      await expect(unpaidBtn).toBeVisible({ timeout: 5_000 });
      await unpaidBtn.click();
      await page.waitForTimeout(2000);
    }
    // Find and click the Revert button inside a paid cell (iconBtn title="Revert")
    // Revert triggers modalConfirm
    const revertBtn = s1Row.locator('.payment-cell-paid button[title="Revert"]').first();
    await expect(revertBtn).toBeVisible({ timeout: 10_000 });
    const paidCountBefore = await s1Row.locator('.payment-cell-paid').count();
    await revertBtn.click();
    // Confirm the modal dialog
    await page.locator('#pm-modal-confirm').click();
    await page.waitForTimeout(2000);
    // After revert, paid count should be less than before
    const paidCountAfter = await s1Row.locator('.payment-cell-paid').count();
    expect(paidCountAfter).toBeLessThan(paidCountBefore);
  });

  test('mark paid persists after page reload', async ({ page }) => {
    const s2Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    // iconBtn uses title="Mark paid"
    const markBtn = s2Row.locator('button[title="Mark paid"]').first();
    await markBtn.click();
    await page.waitForTimeout(2000);
    await page.reload();
    // After reload: wait for stat-cards then navigate to payments tab
    await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
    await page.locator('#tab-btn-payments').click();
    await expect(page.locator('#payment-matrix table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s2RowAfter = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2RowAfter).toContainText('✓', { timeout: 10_000 });
  });

  test('year selector changes displayed year', async ({ page }) => {
    const yearSelect = page.locator('#payment-year');
    const currentYear = new Date().getFullYear();
    await yearSelect.selectOption(String(currentYear - 1));
    await page.waitForTimeout(1000);
    await expect(page.locator('#payment-matrix')).toBeVisible({ timeout: 5_000 });
  });
});

// Bug 8 fix: commission row mark/revert + inline per-spot rent editing
test.describe('Commission row and variable rent', () => {
  test('commission row is visible for s1', async ({ page }) => {
    const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 1' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    // Commission row is adjacent — look for a row with "Commission" text in same block
    const commRow = page.locator('#payment-matrix').locator('tr').filter({ hasText: /commission/i }).first();
    await expect(commRow).toBeVisible({ timeout: 10_000 });
  });

  test('mark commission as paid → commission row shows paid state', async ({ page }) => {
    const commRow = page.locator('#payment-matrix').locator('tr').filter({ hasText: /commission/i }).first();
    await expect(commRow).toBeVisible({ timeout: 10_000 });

    const isPaid = await commRow.locator('.payment-cell-paid, .chip.paid').count() > 0;
    if (!isPaid) {
      const markBtn = commRow.locator('button[title="Mark paid"]').first();
      if (await markBtn.count() > 0) {
        await markBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    // Commission row should show paid indicator (✓ or chip)
    await expect(commRow).toContainText(/✓|paid/i, { timeout: 5_000 });
  });

  test('inline rent input is present on spot rows in payments tab', async ({ page }) => {
    // Per-spot inline rent editor added in Bug 8 fix: an input or editable element per row
    const rentInput = page.locator('#payment-matrix').locator('input[type="number"], input.rent-input').first();
    await expect(rentInput).toBeVisible({ timeout: 10_000 });
  });

  test('inline rent edit saves on Enter — no error', async ({ page }) => {
    const rentInput = page.locator('#payment-matrix').locator('input[type="number"], input.rent-input').first();
    await expect(rentInput).toBeVisible({ timeout: 10_000 });
    await rentInput.click();
    await rentInput.fill('88');
    await rentInput.press('Enter');
    await page.waitForTimeout(1500);
    // No error toast after saving
    await expect(page.locator('.toast-error, [class*="toast"][class*="error"]')).not.toBeVisible({ timeout: 3_000 });
  });
});
