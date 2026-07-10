// tests/e2e/admin-payments-mutations.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await page.locator('#tab-btn-payments').click();
  await expect(page.locator('#payment-year')).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
});

test.describe('Mark paid / revert', () => {
  test('mark s2 current month as paid → cell shows ✓', async ({ page }) => {
    const s2Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    const markBtn = s2Row.locator('button, .payment-cell-unpaid').first();
    await markBtn.click();
    await page.waitForTimeout(2000);
    await expect(s2Row).toContainText('✓');
  });

  test('revert s1 paid month → cell no longer shows paid styling', async ({ page }) => {
    const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 1' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    const paidCell = s1Row.locator('.payment-cell-paid').first();
    await paidCell.click();
    await page.waitForTimeout(2000);
    await expect(s1Row.locator('.payment-cell-paid').first()).not.toBeVisible({ timeout: 5_000 });
  });

  test('mark paid persists after page reload', async ({ page }) => {
    const s2Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    const markBtn = s2Row.locator('button, .payment-cell-unpaid').first();
    await markBtn.click();
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#tab-btn-payments').click();
    await page.waitForLoadState('networkidle');
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
