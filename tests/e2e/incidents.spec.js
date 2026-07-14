// tests/e2e/incidents.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';
const ADMIN_USER  = 'TEST-ADMIN';
const ADMIN_PASS  = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, RENTER_USER, RENTER_PASS);
  await page.waitForURL(/parking\.html/, { timeout: 30_000 });
  // Navigate to incidents via nav link — data-i18n="nav.incidents" → href="incident.html"
  await page.locator('a[href="incident.html"], a[href*="incident"]').first().click();
  await page.waitForURL(/incident/, { timeout: 10_000 });
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
    await expect(page.locator('.toast-success, .alert-success, .pm-toast-success').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Incidents — seeded data visibility (renter)', () => {
  test('seeded incident HD-ZZ-000 is visible in log', async ({ page }) => {
    await expect(
      page.locator('#incident-log, .incident-log').locator('text=HD-ZZ-000')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('seeded incident note text is visible', async ({ page }) => {
    await expect(
      page.locator('#incident-log, .incident-log').locator('text=Test incident for E2E')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('renter does NOT see delete button on incident', async ({ page }) => {
    const log = page.locator('#incident-log, .incident-log');
    await expect(log.first()).toBeVisible({ timeout: 10_000 });
    // No delete button should be present for renter
    const deleteBtn = log.locator('button').filter({ hasText: /delete|remove|trash/i });
    await expect(deleteBtn.first()).not.toBeVisible();
  });
});

test.describe('Incidents — admin delete button visibility', () => {
  test('admin sees delete button on seeded incident', async ({ browser }) => {
    const adminCtx  = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    await loginAs(adminPage, ADMIN_USER, ADMIN_PASS);
    await adminPage.waitForURL(/admin\.html/, { timeout: 30_000 });
    // Use toBeVisible instead of networkidle — loadPendingRegistrations blocks networkidle in CI
    await expect(adminPage.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });

    // Admin navigates to incident log (admin.html has incident section or separate page)
    await adminPage.locator('a[href="incident.html"], a[href*="incident"]').first().click();
    await adminPage.waitForURL(/incident/, { timeout: 10_000 });

    const log = adminPage.locator('#incident-log, .incident-log');
    await expect(log.first()).toBeVisible({ timeout: 10_000 });
    // Admin should see at least one delete button
    const deleteBtn = log.locator('button').filter({ hasText: /delete|remove|trash/i }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });

    await adminCtx.close();
  });
});
