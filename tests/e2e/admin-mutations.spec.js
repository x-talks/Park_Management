// tests/e2e/admin-mutations.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
});

// ── Pending registration ───────────────────────────────────────────────────────

test.describe('Pending registration', () => {
  test('approve pending registration HD-DD-004 → user appears in user list', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
      .filter({ hasText: 'HD-DD-004' }).first();
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    const approveBtn = pendingRow.locator('button').filter({ hasText: /approve/i }).first();
    await approveBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#user-list')).toContainText('HD-DD-004', { timeout: 10_000 });
  });

  test('reject pending registration → row removed from pending list', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
      .filter({ hasText: 'HD-DD-004' }).first();
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    const rejectBtn = pendingRow.locator('button').filter({ hasText: /reject/i }).first();
    await rejectBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#pending-reg-list')).not.toContainText('HD-DD-004');
  });
});

// ── User activate/deactivate ───────────────────────────────────────────────────

test.describe('User activate/deactivate', () => {
  test('deactivate renter HD-CC-003 → row shows inactive state', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    const row = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const deactivateBtn = row.locator('button').filter({ hasText: /deactivate/i }).first();
    await deactivateBtn.click();
    await page.waitForTimeout(2000);
    const updatedRow = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(updatedRow).toContainText(/inactive|deactivated/i);
  });

  test('activate renter HD-CC-003 → row shows active state', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    const row = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const activateBtn = row.locator('button').filter({ hasText: /activate/i }).first();
    await activateBtn.click();
    await page.waitForTimeout(2000);
    const updatedRow = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(updatedRow).not.toContainText(/inactive|deactivated/i);
  });
});

// ── Generate invite ────────────────────────────────────────────────────────────

test.describe('Generate invite', () => {
  test('fill invite form → invite URL is displayed', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    await page.locator('#cu-name').fill('Test');
    await page.locator('#cu-lastname').fill('Invitee');
    await page.locator('#cu-phone').fill('+49300000099');
    await page.locator('#cu-address').fill('Test Street 99');
    await page.locator('#cu-spot').selectOption({ label: /7/ });
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
  test('assign free spot s8 to renter HD-CC-003 → spot shows occupied', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await page.waitForLoadState('networkidle');
    const s8Row = page.locator('#spot-list table tr').filter({ hasText: /^\s*8\s/ }).first();
    await expect(s8Row).toBeVisible({ timeout: 10_000 });
    const assignSelect = s8Row.locator('select').first();
    await assignSelect.selectOption({ label: /HD-CC-003/ });
    const assignBtn = s8Row.locator('button').filter({ hasText: /assign/i }).first();
    await assignBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#spot-list table tr').filter({ hasText: 'HD-CC-003' })).toBeVisible({ timeout: 10_000 });
  });

  test('unassign s1 → spot becomes free', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await page.waitForLoadState('networkidle');
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    const unassignBtn = s1Row.locator('button').filter({ hasText: /unassign/i }).first();
    await unassignBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#spot-list table')).not.toContainText('HD-AA-001');
  });
});

// ── Spot reserve/unreserve ─────────────────────────────────────────────────────

test.describe('Spot reserve/unreserve', () => {
  test('reserve free spot s4 → spot shows Reserved', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await page.waitForLoadState('networkidle');
    const s4Row = page.locator('#spot-list table tr').filter({ hasText: /^\s*4\s/ }).first();
    await expect(s4Row).toBeVisible({ timeout: 10_000 });
    const reserveBtn = s4Row.locator('button').filter({ hasText: /reserve/i }).first();
    await reserveBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#spot-list table tr').filter({ hasText: /reserved/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('unreserve s3 → spot no longer shows Reserved', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await page.waitForLoadState('networkidle');
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /Reserved/i }).first();
    await expect(s3Row).toBeVisible({ timeout: 10_000 });
    const unreserveBtn = s3Row.locator('button').filter({ hasText: /unreserve/i }).first();
    await unreserveBtn.click();
    await page.waitForTimeout(2000);
    await expect(s3Row).not.toContainText(/reserved/i);
  });
});
