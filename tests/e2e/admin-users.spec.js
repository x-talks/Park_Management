// tests/e2e/admin-users.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 30_000 });
  // Do NOT use waitForLoadState('networkidle') — renderUsers() calls loadPendingRegistrations()
  // which is slow in CI and blocks networkidle. Use waitForFunction instead.
  await page.waitForFunction(
    () => {
      const ul = document.getElementById('user-list');
      return ul && ul.querySelector('table tr');
    },
    { timeout: 45_000 }
  );
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
  test('HD-DD-004 appears in pending list or user list', async ({ page }) => {
    // Tests 9/10 (admin-mutations.spec.js) run before this test and may have already
    // approved or rejected HD-DD-004. After approval it moves to #user-list; after
    // rejection it is removed entirely from #pending-reg-list. Accept either outcome:
    // HD-DD-004 must exist in at least one of the two sections.
    const pendingText = (await page.locator('#pending-reg-list').textContent({ timeout: 10_000 })) || '';
    const userText = (await page.locator('#user-list').textContent({ timeout: 10_000 })) || '';
    expect(pendingText + userText).toContain('HD-DD-004');
  });
});
