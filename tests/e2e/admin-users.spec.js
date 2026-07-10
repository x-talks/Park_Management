// tests/e2e/admin-users.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  // Users tab is default (#tab-btn-users)
  const usersTab = page.locator('#tab-btn-users');
  if (await usersTab.count() > 0) await usersTab.first().click();
  await expect(page.locator('#user-list table tr').first()).toBeVisible({ timeout: 15_000 });
});

test.describe('User list', () => {
  test('at least 5 users visible in the table', async ({ page }) => {
    // Users are rendered in #user-list > .table-wrap > table
    const rows = page.locator('#user-list table tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    // First row is header, so actual user rows start at index 1
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(6); // 1 header + 5 users minimum
  });

  test('HD-AA-001 (renter A) is in the table', async ({ page }) => {
    await expect(page.locator('#user-list')).toContainText('HD-AA-001', { timeout: 10_000 });
  });

  test('HD-BB-002 (renter B) shows termination chip', async ({ page }) => {
    const row = page.locator('#user-list tr').filter({ hasText: 'HD-BB-002' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    // Termination chip has class termination-chip
    await expect(row.locator('.termination-chip')).toBeVisible();
  });

  test('master user row has no deactivate/activate button', async ({ page }) => {
    const masterRow = page.locator('#user-list tr').filter({ hasText: 'TEST-MASTER' }).first();
    // Master rows have no action buttons (isMaster check in renderUsers)
    const actionBtns = masterRow.locator('.icon-btn');
    await expect(actionBtns).toHaveCount(0);
  });
});

test.describe('Pending registrations', () => {
  test('pending registrations section shows HD-DD-004', async ({ page }) => {
    // Pending registrations are in #pending-reg-list
    await expect(page.locator('#pending-reg-list')).toContainText('HD-DD-004', { timeout: 10_000 });
  });
});
