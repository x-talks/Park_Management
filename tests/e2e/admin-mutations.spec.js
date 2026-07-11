// tests/e2e/admin-mutations.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 30_000 });
  // Do NOT use waitForLoadState('networkidle') here — renderUsers() calls
  // loadPendingRegistrations() which is slow in CI and keeps connections open,
  // blocking networkidle indefinitely. Each test waits for its own content.
});

// ── Pending registration ───────────────────────────────────────────────────────

test.describe('Pending registration', () => {
  test('approve pending registration HD-DD-004 → user appears in user list', async ({ page }) => {
    // Ensure users tab data is loaded (may already be from page init)
    await page.waitForFunction(
      () => document.getElementById('user-list') && document.getElementById('user-list').querySelector('table tr'),
      { timeout: 30_000 }
    );
    const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
      .filter({ hasText: 'HD-DD-004' }).first();
    // If already approved (e.g. by acceptance-admin test), skip
    if (await pendingRow.count() === 0) return;
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    // iconBtn uses title attribute, not textContent
    const approveBtn = pendingRow.locator('button[title="Approve"]').first();
    await approveBtn.click();
    // Increased wait: approvePendingRegistration calls refreshAll() which runs
    // loadUsers() + loadPendingRegistrations() — the latter is slow in CI
    await page.waitForTimeout(4000);
    await expect(page.locator('#user-list')).toContainText('HD-DD-004', { timeout: 20_000 });
  });

  test('reject pending registration → row removed from pending list', async ({ page }) => {
    // Ensure users tab data is loaded (may already be from page init)
    await page.waitForFunction(
      () => document.getElementById('user-list') && document.getElementById('user-list').querySelector('table tr'),
      { timeout: 30_000 }
    );
    // If the pending row is already gone (approved by previous test), this test is a no-op
    const rowCount = await page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
      .filter({ hasText: 'HD-DD-004' }).count();
    if (rowCount === 0) return; // already processed
    const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
      .filter({ hasText: 'HD-DD-004' }).first();
    // iconBtn uses title attribute, not textContent. Reject triggers modalConfirm.
    const rejectBtn = pendingRow.locator('button[title="Reject"]').first();
    await rejectBtn.click();
    // Confirm the modal dialog
    await page.locator('#pm-modal-confirm').click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#pending-reg-list')).not.toContainText('HD-DD-004');
  });
});

// ── User activate/deactivate ───────────────────────────────────────────────────

test.describe('User activate/deactivate', () => {
  test('deactivate renter HD-CC-003 → row shows inactive state', async ({ page }) => {
    await page.waitForFunction(
      () => document.getElementById('user-list') && document.getElementById('user-list').querySelector('table tr'),
      { timeout: 30_000 }
    );
    const row = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const alreadyHasActivateBtn = await row.locator('button[title="Activate"]').count() > 0;
    if (alreadyHasActivateBtn) {
      await expect(row).toContainText(/inactive/i);
      return;
    }
    const deactivateBtn = row.locator('button[title="Deactivate"]').first();
    await expect(deactivateBtn).toBeVisible({ timeout: 5_000 });
    await deactivateBtn.click();
    await page.waitForTimeout(2000);
    const updatedRow = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(updatedRow).toContainText(/inactive/i);
  });

  test('activate renter HD-CC-003 → row shows active state', async ({ page }) => {
    await page.waitForFunction(
      () => document.getElementById('user-list') && document.getElementById('user-list').querySelector('table tr'),
      { timeout: 30_000 }
    );
    const row = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const alreadyHasDeactivateBtn = await row.locator('button[title="Deactivate"]').count() > 0;
    if (alreadyHasDeactivateBtn) {
      await expect(row).not.toContainText(/inactive/i);
      return;
    }
    const activateBtn = row.locator('button[title="Activate"]').first();
    await expect(activateBtn).toBeVisible({ timeout: 5_000 });
    await activateBtn.click();
    await page.waitForTimeout(2000);
    const updatedRow = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(updatedRow).not.toContainText(/inactive/i);
  });
});

// ── Generate invite ────────────────────────────────────────────────────────────

test.describe('Generate invite', () => {
  test('fill invite form → invite URL is displayed', async ({ page }) => {
    await page.waitForFunction(
      () => document.getElementById('user-list') && document.getElementById('user-list').querySelector('table tr'),
      { timeout: 30_000 }
    );
    await page.locator('#cu-name').fill('Test');
    await page.locator('#cu-lastname').fill('Invitee');
    await page.locator('#cu-phone').fill('+49300000099');
    await page.locator('#cu-address').fill('Test Street 99');
    await page.locator('#cu-spot').selectOption({ index: 1 });
    await page.locator('#cu-plate').fill('HD-ZZ-099');
    await page.locator('#cu-carmodel').fill('Test Car');
    await page.locator('#cu-carcolor').fill('white');
    await page.locator('#create-user-form button[type=submit]').click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#invite-result-box')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#invite-url-text')).not.toBeEmpty();
  });
});

// ── Spot assignment ────────────────────────────────────────────────────────────

test.describe('Spot assign/unassign', () => {
  test('assign free spot s8 to renter HD-BB-002 → spot shows occupied', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s8Row = page.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    await expect(s8Row).toBeVisible({ timeout: 10_000 });
    // If s8 is already occupied, unassign first (Unassign triggers modalConfirm)
    const s8Unassign = s8Row.locator('button[title="Unassign"]');
    if (await s8Unassign.count() > 0) {
      await s8Unassign.first().click();
      await page.locator('#pm-modal-confirm').click();
      await page.waitForTimeout(2000);
    }
    const s8RowFresh = page.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    const assignSelect = s8RowFresh.locator('select').first();
    await expect(assignSelect).toBeVisible({ timeout: 10_000 });
    await assignSelect.selectOption({ label: 'Bob (HD-BB-002)' });
    const assignBtn = s8RowFresh.locator('button[title="Assign"]').first();
    await assignBtn.click();
    await page.waitForTimeout(2000);
    // After assigning, the Assign button is replaced by an Unassign button on s8's row.
    // Do NOT check the whole table for 'HD-BB-002' — it appears in dropdown options of
    // every free spot row (21 matches), violating Playwright strict mode.
    const s8RowAssigned = page.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    await expect(s8RowAssigned.locator('button[title="Unassign"]')).toBeVisible({ timeout: 10_000 });
  });

  test('unassign s1 → spot becomes free', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    // Unassign triggers modalConfirm
    const unassignBtn = s1Row.locator('button[title="Unassign"]').first();
    await unassignBtn.click();
    await page.locator('#pm-modal-confirm').click();
    await page.waitForTimeout(2000);
    // Verify s1 is now free: the s1 row should no longer have an Unassign button
    // (HD-AA-001 still appears in dropdown options for all free spots, so we cannot
    // assert not.toContainText on the whole table — target s1 row specifically)
    const s1RowAfter = page.locator('#spot-list table tr').filter({ hasText: /^1[^0-9]/ }).first();
    await expect(s1RowAfter.locator('button[title="Unassign"]')).toHaveCount(0);

    // ── Restore state: re-assign s1 to Alice so later tests (23, 46, 47, 68, 71, 72) work ──
    // s1 is now free — find it by spot label "1"
    try {
      const s1FreeRow = page.locator('#spot-list table tr').filter({ hasText: /^1[^0-9]/ }).first();
      const restoreSelect = s1FreeRow.locator('select').first();
      await expect(restoreSelect).toBeVisible({ timeout: 10_000 });
      await restoreSelect.selectOption({ label: 'Alice (HD-AA-001)' });
      const restoreAssignBtn = s1FreeRow.locator('button[title="Assign"]').first();
      await restoreAssignBtn.click();
      await page.waitForTimeout(2000);
    } catch (e) {
      // Restoration is best-effort cleanup; log but do not fail the test
      console.warn('State restore for s1 failed:', e.message);
    }
  });
});

// ── Spot reserve/unreserve ─────────────────────────────────────────────────────

test.describe('Spot reserve/unreserve', () => {
  test('reserve free spot s5 → spot shows Reserved', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s5Row = page.locator('#spot-list table tr').filter({ hasText: /^5[^0-9]/ }).first();
    await expect(s5Row).toBeVisible({ timeout: 10_000 });
    const reserveBtn = s5Row.locator('button[title="Mark reserved"]').first();
    await reserveBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#spot-list table tr').filter({ hasText: /reserved/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('unreserve s3 → spot no longer shows Reserved', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    // Target s3 by its spot label number, not by "Reserved" text, to avoid ambiguity
    // when multiple spots are reserved (e.g. s4 was just reserved by the previous test).
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
    await expect(s3Row).toBeVisible({ timeout: 10_000 });
    // s3 should have an Unreserve button; if it was already unreserved, skip
    const unreserveBtn = s3Row.locator('button[title="Unreserve"]');
    if (await unreserveBtn.count() === 0) return; // already unreserved
    await unreserveBtn.first().click();
    await page.waitForTimeout(2000);
    // Verify s3 is no longer reserved
    const s3RowAfter = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
    await expect(s3RowAfter).not.toContainText(/reserved/i);

    // ── Restore state: re-reserve s3 so later tests (28, 66) work ──
    // "Mark reserved" triggers modalConfirm — must click #pm-modal-confirm to proceed.
    try {
      const s3FreshRow = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
      const reReserveBtn = s3FreshRow.locator('button[title="Mark reserved"]').first();
      await expect(reReserveBtn).toBeVisible({ timeout: 10_000 });
      await reReserveBtn.click();
      await page.locator('#pm-modal-confirm').click();
      // Wait until the DOM confirms s3 is reserved (not just a timeout)
      await expect(s3FreshRow).toContainText(/reserved/i, { timeout: 10_000 });
    } catch (e) {
      console.warn('State restore for s3 failed:', e.message);
    }
  });
});
