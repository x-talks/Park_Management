// e2e/admin-users.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
  // Users tab is the default — wait for user list to render
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
    const rows = page.locator('#user-list table tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(6); // 1 header + 5 users minimum
  });

  test('HD-AA-001 (renter A) is in the table', async ({ page }) => {
    await expect(page.locator('#user-list')).toContainText('HD-AA-001', { timeout: 10_000 });
  });

  test('HD-BB-002 (renter B) shows termination chip', async ({ page }) => {
    const row = page.locator('#user-list tr').filter({ hasText: 'HD-BB-002' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator('.termination-chip')).toBeVisible();
  });

  test('master user row has no action buttons', async ({ page }) => {
    const masterRow = page.locator('#user-list tr').filter({ hasText: 'TEST-MASTER' }).first();
    const actionBtns = masterRow.locator('.icon-btn, .icon-sm');
    await expect(actionBtns).toHaveCount(0);
  });
});

test.describe('Pending registrations', () => {
  test('HD-DD-004 appears in pending list or user list', async ({ page }) => {
    const pendingText = (await page.locator('#pending-reg-list').textContent({ timeout: 10_000 }).catch(() => '')) || '';
    const userText = (await page.locator('#user-list').textContent({ timeout: 10_000 })) || '';
    expect(pendingText + userText).toContain('HD-DD-004');
  });
});

test.describe('Direct create user', () => {
  test('direct create form is visible in the UI', async ({ page }) => {
    await expect(page.locator('#direct-create-section')).toBeVisible({ timeout: 10_000 });
  });

  test('direct create — fills form and submits, user appears in list', async ({ page }) => {
    const plate = `HD-ZZ-${Date.now().toString().slice(-3)}`;

    // IDs use dc-fname / dc-lname in the Svelte component
    await page.locator('#dc-fname').fill('Direct');
    await page.locator('#dc-lname').fill('Testuser');
    await page.locator('#dc-phone').fill('+49300000001');
    await page.locator('#dc-address').fill('Test Street 99');
    await page.locator('#dc-plate').fill(plate);
    await page.locator('#dc-password').fill('DirectPass123!');

    const spotSel = page.locator('#dc-spot').first();
    if (await spotSel.count() > 0) {
      const opts = await spotSel.locator('option').count();
      if (opts > 1) await spotSel.selectOption({ index: 1 });
    }

    const submitBtn = page.locator('#direct-create-section button[type=submit]').first();
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);

    await expect(page.locator('.toast-error, [class*="toast"][class*="error"]')).not.toBeVisible({ timeout: 3_000 });
    await expect(page.locator('#user-list')).toContainText(plate, { timeout: 10_000 });
  });
});
