// tests/e2e/acceptance-admin.spec.js
import { test, expect } from './fixtures.js';
import { loginAs, waitForAppReady } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test('Full admin journey: login → generate invite → approve pending registration → mark payment paid', async ({ page }) => {
  // Step 1: Login as admin
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 30_000 });
  await waitForAppReady(page, 'admin');

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
  // Do NOT use waitForLoadState('networkidle') — refreshAll() re-triggers loadPendingRegistrations()
  await expect(page.locator('#invite-result-box')).toBeVisible({ timeout: 10_000 });
  const inviteUrl = await page.locator('#invite-url-text').textContent();
  expect(inviteUrl).toBeTruthy();

  // Step 4: Approve HD-DD-004 only if it is still pending AND not yet a user.
  // admin-mutations.spec.js may have already approved it — attempting a second approve
  // returns 400 "License plate already registered" which opens a modal and blocks the tab.
  const alreadyUser = await page.locator('#user-list').evaluate(
    el => el.textContent.includes('HD-DD-004')
  );
  if (!alreadyUser) {
    const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
      .filter({ hasText: 'HD-DD-004' }).first();
    if (await pendingRow.count() > 0) {
      await expect(pendingRow).toBeVisible({ timeout: 10_000 });
      await pendingRow.locator('button[title="Approve"]').first().click();
      await page.waitForTimeout(2000);
    }
  }
  await expect(page.locator('#user-list')).toContainText('HD-DD-004', { timeout: 10_000 });

  // Step 5: Force-close any open modal before clicking the Payments tab.
  // A prior step may have triggered a modalAlert (e.g. approve error) that blocks clicks.
  await page.evaluate(() => {
    const o = document.getElementById('pm-modal-overlay');
    if (o && o.classList.contains('open')) o.classList.remove('open');
  });

  // Navigate to payments, verify s1 shows paid
  const paymentsTab = page.locator('#tab-btn-payments');
  await paymentsTab.scrollIntoViewIfNeeded();
  await expect(paymentsTab).toBeEnabled({ timeout: 10_000 });
  await paymentsTab.click();
  await expect(page.locator('#payment-matrix table tr').nth(1)).toBeVisible({ timeout: 30_000 });
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
