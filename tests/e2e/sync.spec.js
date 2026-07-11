// tests/e2e/sync.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.describe('Multi-user sync (L6)', () => {
  test('admin marks s2 paid → renter HD-BB-002 sees updated payment status after reload', async ({ browser }) => {
    test.setTimeout(120_000); // payment matrix load + two-browser sync can exceed 60s default
    const adminCtx  = await browser.newContext();
    const renterCtx = await browser.newContext();
    const adminPage  = await adminCtx.newPage();
    const renterPage = await renterCtx.newPage();

    await Promise.all([
      loginAs(adminPage,  ADMIN_USER, ADMIN_PASS),
      loginAs(renterPage, 'HD-BB-002', 'TestPass123!'),
    ]);

    await adminPage.waitForURL(/admin\.html/, { timeout: 30_000 });
    // Wait for users tab to fully render (renderUsers completes) before switching tabs.
    // waitForFunction on stat-cards fires too early (element exists before data loads).
    await adminPage.waitForFunction(
      () => {
        const ul = document.getElementById('user-list');
        return ul && ul.querySelector('table tr');
      },
      { timeout: 30_000 }
    );
    await adminPage.locator('#tab-btn-payments').click();
    await expect(adminPage.locator('#payment-matrix table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    // Use Spot 6 (Carol) — seeded with no payments, so Mark paid buttons always available
    // even after tests 18/20 consume both of Bob's (Spot 2) unpaid cells.
    const s6Row = adminPage.locator('#payment-matrix table tr').filter({ hasText: 'Spot 6' }).first();
    await expect(s6Row).toBeVisible({ timeout: 10_000 });
    const markBtn = s6Row.locator('button[title="Mark paid"]').first();
    await expect(markBtn).toBeVisible({ timeout: 10_000 });
    await markBtn.click();
    await adminPage.waitForTimeout(2000);

    await renterPage.waitForURL(/parking\.html/, { timeout: 30_000 });
    await renterPage.reload();
    await renterPage.waitForLoadState('networkidle');
    await expect(renterPage.locator('#my-payments-section')).toContainText(/paid|✓/i, { timeout: 10_000 });

    await adminCtx.close();
    await renterCtx.close();
  });

  test('admin assigns spot s8 to HD-BB-002 → renter sees occupied s8 on map after reload', async ({ browser }) => {
    const adminCtx  = await browser.newContext();
    const renterCtx = await browser.newContext();
    const adminPage  = await adminCtx.newPage();
    const renterPage = await renterCtx.newPage();

    await Promise.all([
      loginAs(adminPage,  ADMIN_USER, ADMIN_PASS),
      loginAs(renterPage, 'HD-AA-001', 'TestPass123!'),
    ]);

    await adminPage.waitForURL(/admin\.html/, { timeout: 30_000 });
    // Use toBeVisible instead of networkidle — loadPendingRegistrations blocks networkidle in CI
    await expect(adminPage.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
    await adminPage.locator('#tab-btn-spots').click();
    await expect(adminPage.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s8Row = adminPage.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    await expect(s8Row).toBeVisible({ timeout: 10_000 });

    // If s8 is already assigned (from a prior test), unassign it first (Unassign triggers modalConfirm)
    const unassignBtn = s8Row.locator('button[title="Unassign"]');
    if (await unassignBtn.count() > 0) {
      await unassignBtn.first().click();
      await adminPage.locator('#pm-modal-confirm').click();
      await adminPage.waitForTimeout(2000);
    }

    // Now assign s8 to HD-BB-002 (Bob — active renter, shown as "Bob (HD-BB-002)" in dropdown)
    const s8RowFresh = adminPage.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    const assignSelect = s8RowFresh.locator('select').first();
    await expect(assignSelect).toBeVisible({ timeout: 10_000 });
    await assignSelect.selectOption({ label: 'Bob (HD-BB-002)' });
    // iconBtn uses title="Assign"
    await s8RowFresh.locator('button[title="Assign"]').first().click();
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
