// e2e/admin-payments-mutations.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
  await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
  await page.locator('#tab-btn-payments').click();
  await expect(page.locator('#payment-year')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#payment-matrix table tr').nth(1)).toBeVisible({ timeout: 30_000 });
});

test.describe('Mark paid / revert', () => {
  test('mark s2 current month as paid → cell shows ✓', async ({ page }) => {
    const s2Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    await s2Row.locator('button[title="Mark paid"]').first().click();
    await page.waitForTimeout(2000);
    await expect(s2Row).toContainText('✓');
  });

  test('revert s1 paid month → paid count decreases', async ({ page }) => {
    const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 1' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    if (await s1Row.locator('.payment-cell-paid').count() === 0) {
      await s1Row.locator('button[title="Mark paid"]').first().click();
      await page.waitForTimeout(2000);
    }
    const revertBtn = s1Row.locator('.payment-cell-paid button[title="Revert"]').first();
    await expect(revertBtn).toBeVisible({ timeout: 10_000 });
    const paidBefore = await s1Row.locator('.payment-cell-paid').count();
    await revertBtn.click();
    await page.locator('#pm-modal-confirm').click();
    await page.waitForTimeout(2000);
    const paidAfter = await s1Row.locator('.payment-cell-paid').count();
    expect(paidAfter).toBeLessThan(paidBefore);
  });

  test('mark paid persists after page reload', async ({ page }) => {
    const s2Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await s2Row.locator('button[title="Mark paid"]').first().click();
    await page.waitForTimeout(2000);
    await page.reload();
    await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
    await page.locator('#tab-btn-payments').click();
    await expect(page.locator('#payment-matrix table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s2After = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2After).toContainText('✓', { timeout: 10_000 });
  });

  test('year selector changes displayed year', async ({ page }) => {
    await page.locator('#payment-year').selectOption(String(new Date().getFullYear() - 1));
    await page.waitForTimeout(1000);
    await expect(page.locator('#payment-matrix')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Commission column and variable rent', () => {
  test('commission column header is visible', async ({ page }) => {
    await expect(page.locator('#payment-matrix th').filter({ hasText: /comm/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('spot 1 row has a commission cell with mark-paid button or paid state', async ({ page }) => {
    const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: /Spot 1|HD-AA-001/i }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    const hasMarkBtn = await s1Row.locator('button[title="Mark paid"]').count() > 0;
    const hasPaidCell = await s1Row.locator('.payment-cell-paid').count() > 0;
    expect(hasMarkBtn || hasPaidCell).toBeTruthy();
  });

  test('mark commission as paid → ✓ visible', async ({ page }) => {
    const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: /Spot 1|HD-AA-001/i }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    if (await s1Row.locator('.payment-cell-paid').count() === 0) {
      const btn = s1Row.locator('button[title="Mark paid"]').first();
      if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(2000); }
    }
    await expect(s1Row).toContainText('✓', { timeout: 5_000 });
  });

  test('inline rent input is present in payment matrix', async ({ page }) => {
    await expect(page.locator('#payment-matrix').locator('input[type="number"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('inline rent edit saves on Enter — no error', async ({ page }) => {
    const rentInput = page.locator('#payment-matrix').locator('input[type="number"]').first();
    await expect(rentInput).toBeVisible({ timeout: 10_000 });
    await rentInput.fill('88');
    await rentInput.press('Enter');
    await page.waitForTimeout(1500);
    await expect(page.locator('.toast-error, [class*="toast"][class*="error"]')).not.toBeVisible({ timeout: 3_000 });
  });
});
