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

// Bug 7 fix: admin can directly create a user without invite flow
test.describe('Direct create user', () => {
  test('direct create form is visible in the UI', async ({ page }) => {
    // The direct-create section must be rendered (added in Bug 7 fix)
    const section = page.locator('#direct-create-section, [id*="direct"], .direct-create-card').first();
    await expect(section).toBeVisible({ timeout: 10_000 });
  });

  test('direct create — fills form and submits, user appears in list', async ({ page }) => {
    const plate = `HD-ZZ-${Date.now().toString().slice(-3)}`;

    // Fill direct create form fields
    const dc = (id) => page.locator(`#dc-${id}, [id*="dc-${id}"]`).first();
    await dc('name').fill('Direct');
    await dc('lastname').fill('Testuser');
    await dc('phone').fill('+49300000001');
    await dc('address').fill('Test Street 99');
    await dc('plate').fill(plate);
    await dc('password').fill('DirectPass123!');

    // Select first available spot if select exists
    const spotSel = page.locator('#dc-spot').first();
    if (await spotSel.count() > 0) {
      const opts = await spotSel.locator('option').count();
      if (opts > 1) await spotSel.selectOption({ index: 1 });
    }

    // Submit
    const submitBtn = page.locator('#direct-create-form button[type=submit], form button[type=submit]')
      .filter({ hasText: /create|add/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);

    // No error toast
    await expect(page.locator('.toast-error, [class*="toast"][class*="error"]')).not.toBeVisible({ timeout: 3_000 });

    // Plate should now appear in user list
    await expect(page.locator('#user-list')).toContainText(plate, { timeout: 10_000 });
  });
});
