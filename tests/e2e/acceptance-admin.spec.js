// tests/e2e/acceptance-admin.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test('Full admin journey: login → generate invite → approve pending registration → mark payment paid', async ({ page }) => {
  // Step 1: Login as admin
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 45_000 });
  await page.waitForLoadState('networkidle');

  // Step 2: Stat cards visible
  await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 10_000 });

  // Step 3: Generate invite for a free spot
  await page.locator('#cu-name').fill('Acceptance');
  await page.locator('#cu-lastname').fill('Tester');
  await page.locator('#cu-phone').fill('+49300000099');
  await page.locator('#cu-address').fill('Acceptance Street 1');
  await page.locator('#cu-spot').selectOption({ index: 1 });
  await page.locator('#cu-plate').fill('HD-YY-099');
  await page.locator('#cu-carmodel').fill('Test Model');
  await page.locator('#cu-carcolor').fill('red');
  await page.locator('#create-user-form button[type=submit]').click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#invite-result-box')).toBeVisible({ timeout: 10_000 });
  const inviteUrl = await page.locator('#invite-url-text').textContent();
  expect(inviteUrl).toBeTruthy();

  // Step 4: Approve the existing pending registration HD-DD-004 (if not already approved)
  const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
    .filter({ hasText: 'HD-DD-004' }).first();
  const pendingExists = await pendingRow.count() > 0;
  if (pendingExists) {
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    await pendingRow.locator('button').filter({ hasText: /approve/i }).first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#user-list')).toContainText('HD-DD-004', { timeout: 10_000 });
  } else {
    // Already approved by a previous test — verify it's in user list
    await expect(page.locator('#user-list')).toContainText('HD-DD-004', { timeout: 10_000 });
  }

  // Step 5: Navigate to payments, verify s1 shows paid
  await page.locator('#tab-btn-payments').click();
  await page.waitForLoadState('networkidle');
  const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 1' }).first();
  await expect(s1Row).toBeVisible({ timeout: 10_000 });
  await expect(s1Row).toContainText('✓');

  // Step 6: CSV export works
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10_000 }),
    page.locator('#csv-export-btn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
});
