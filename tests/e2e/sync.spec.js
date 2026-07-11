// tests/e2e/sync.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.describe('Multi-user sync (L6)', () => {
  test('admin marks s2 paid → renter HD-BB-002 sees updated payment status after reload', async ({ browser }) => {
    const adminCtx  = await browser.newContext();
    const renterCtx = await browser.newContext();
    const adminPage  = await adminCtx.newPage();
    const renterPage = await renterCtx.newPage();

    await Promise.all([
      loginAs(adminPage,  ADMIN_USER, ADMIN_PASS),
      loginAs(renterPage, 'HD-BB-002', 'TestPass123!'),
    ]);

    await adminPage.waitForURL(/admin\.html/, { timeout: 30_000 });
    await adminPage.waitForLoadState('networkidle');
    await adminPage.locator('#tab-btn-payments').click();
    await adminPage.waitForLoadState('networkidle');
    const s2Row = adminPage.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    const markBtn = s2Row.locator('button, .payment-cell-unpaid').first();
    await markBtn.click();
    await adminPage.waitForTimeout(2000);

    await renterPage.waitForURL(/parking\.html/, { timeout: 30_000 });
    await renterPage.reload();
    await renterPage.waitForLoadState('networkidle');
    await expect(renterPage.locator('#my-payments-section')).toContainText(/paid|✓/i, { timeout: 10_000 });

    await adminCtx.close();
    await renterCtx.close();
  });

  test('admin assigns spot s8 to HD-CC-003 → renter sees occupied s8 on map after reload', async ({ browser }) => {
    const adminCtx  = await browser.newContext();
    const renterCtx = await browser.newContext();
    const adminPage  = await adminCtx.newPage();
    const renterPage = await renterCtx.newPage();

    await Promise.all([
      loginAs(adminPage,  ADMIN_USER, ADMIN_PASS),
      loginAs(renterPage, 'HD-AA-001', 'TestPass123!'),
    ]);

    await adminPage.waitForURL(/admin\.html/, { timeout: 30_000 });
    await adminPage.waitForLoadState('networkidle');
    await adminPage.locator('#tab-btn-spots').click();
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForTimeout(2000);
    const s8Row = adminPage.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    await expect(s8Row).toBeVisible({ timeout: 10_000 });

    // If s8 is already assigned (from a prior test), unassign it first
    const unassignBtn = s8Row.locator('button').filter({ hasText: /unassign/i });
    if (await unassignBtn.count() > 0) {
      await unassignBtn.first().click();
      await adminPage.waitForTimeout(2000);
      await adminPage.waitForLoadState('networkidle');
    }

    // Now assign s8 to HD-CC-003
    const s8RowFresh = adminPage.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    const assignSelect = s8RowFresh.locator('select').first();
    await expect(assignSelect).toBeVisible({ timeout: 10_000 });
    await assignSelect.selectOption({ label: 'HD-CC-003' });
    await s8RowFresh.locator('button').filter({ hasText: /assign/i }).first().click();
    await adminPage.waitForTimeout(2000);

    await renterPage.waitForURL(/parking\.html/, { timeout: 30_000 });
    await renterPage.reload();
    await renterPage.waitForLoadState('networkidle');
    const s8Spot = renterPage.locator('svg g[data-id="s8"]');
    await expect(s8Spot).toBeVisible({ timeout: 10_000 });
    await expect(s8Spot).toHaveClass(/occupied/, { timeout: 15_000 });

    await adminCtx.close();
    await renterCtx.close();
  });
});
