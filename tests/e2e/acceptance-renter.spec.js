// tests/e2e/acceptance-renter.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test('Full renter journey: login → view map → click own spot → view payments → edit profile', async ({ page }) => {
  // Step 1: Login as renter
  await loginAs(page, RENTER_USER, RENTER_PASS);
  await page.waitForURL(/parking\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  // Step 2: Parking map is visible with spots
  await expect(page.locator('#parking-svg')).toBeVisible({ timeout: 10_000 });
  const spotCount = await page.locator('svg g[data-id]').count();
  expect(spotCount).toBeGreaterThanOrEqual(24);

  // Step 3: Click own spot (s1) → info panel shows own data
  await page.locator('svg g[data-id="s1"]').click();
  await expect(page.locator('#info-panel')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('#info-panel')).toContainText('HD-AA-001');

  // Step 4: My payments section is visible
  await expect(page.locator('#my-payments-section')).toBeVisible({ timeout: 10_000 });
  const currentYear = String(new Date().getFullYear());
  await expect(page.locator('#my-payments-section')).toContainText(currentYear);

  // Step 5: Residents list — toggle and verify it opens
  const residentsToggle = page.locator('#residents-toggle');
  await expect(residentsToggle).toBeVisible({ timeout: 5_000 });
  await residentsToggle.click();
  await expect(page.locator('#residents-panel')).toBeVisible({ timeout: 5_000 });

  // Step 6: Profile edit section is visible, phone field is editable
  await expect(page.locator('#profile-edit-section')).toBeVisible({ timeout: 10_000 });
  const phoneField = page.locator('#p-phone');
  await expect(phoneField).toBeVisible({ timeout: 5_000 });
  await phoneField.fill('+49300000099');
  const saveBtn = page.locator('#profile-edit-section button[type=submit]').first();
  await saveBtn.click();
  await page.waitForTimeout(2000);
  await expect(page.locator('.toast-error, .alert.error')).not.toBeVisible({ timeout: 3_000 });
});
