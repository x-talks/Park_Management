// tests/e2e/incidents.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, RENTER_USER, RENTER_PASS);
  await page.waitForURL(/parking\.html/, { timeout: 15_000 });
  // Navigate to incidents via nav link — data-i18n="nav.incidents" → href="incident.html"
  await page.locator('a[href="incident.html"], a[href*="incident"]').first().click();
  await page.waitForURL(/incident/, { timeout: 10_000 });
  await page.waitForLoadState('networkidle');
});

test.describe('Incidents page', () => {
  test('incident form is visible', async ({ page }) => {
    await expect(page.locator('form, #inc-form, .incident-form').first()).toBeVisible({ timeout: 5_000 });
  });

  test('incident log section is visible', async ({ page }) => {
    await expect(page.locator('#incident-log, .incident-log, [data-i18n="inc.log.title"]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('submit incident with note → success message shown', async ({ page }) => {
    const spotSelect = page.locator('select[name="spot"], #inc-spot').first();
    await spotSelect.selectOption({ index: 1 });
    await page.locator('[name="note"], #inc-note, textarea').first().fill('E2E test incident');

    // Photo is required — attach minimal PNG
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });

    await page.locator('button[type="submit"], [data-i18n="inc.btn.submit"]').first().click();
    await expect(page.locator('.toast-success, .alert-success, [data-i18n="inc.success"]').first()).toBeVisible({ timeout: 15_000 });
  });
});
