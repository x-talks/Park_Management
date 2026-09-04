// e2e/journey.spec.js
// Full click-through journey for admin, master, and renter.
import { test, expect } from './fixtures.js';
import { loginAs, waitForAppReady } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';
const MASTER_USER = 'TEST-MASTER';
const MASTER_PASS = process.env.STAGING_MASTER_PASSWORD || 'ParkManagement123!';
const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test('Admin journey: login → /admin → nav to /parking → Admin link visible → /incident → back to /admin', async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/\/admin/, { timeout: 20_000 });
  await waitForAppReady(page, 'admin');

  await expect(page.locator('.user-chip')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.lang-globe-btn')).toBeVisible();

  // Navigate to Map
  await page.locator('nav.site-nav a[href*="parking"]').click();
  await page.waitForURL(/\/parking/, { timeout: 10_000 });
  await waitForAppReady(page, 'renter');

  await expect(page.locator('#parking-svg g[data-id]').first()).toBeVisible({ timeout: 10_000 });

  // Admin link visible for admin users
  await expect(page.locator('nav.site-nav a[href*="admin"]').first()).toBeVisible({ timeout: 5_000 });

  // Mobile: bottom nav has Admin tab
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.bottom-nav a[href*="admin"]')).toBeVisible({ timeout: 5_000 });
  await page.setViewportSize({ width: 1280, height: 720 });

  await expect(page.locator('.user-chip')).toBeVisible();

  // Navigate to Incidents
  await page.locator('nav.site-nav a[href*="incident"]').click();
  await page.waitForURL(/\/incident/, { timeout: 10_000 });

  await expect(page.locator('nav.site-nav a[href*="admin"]').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.user-chip')).toBeVisible();

  // Navigate back to Admin
  await page.locator('nav.site-nav a[href*="admin"]').first().click();
  await page.waitForURL(/\/admin/, { timeout: 10_000 });
  await waitForAppReady(page, 'admin');
  await expect(page.locator('#user-list table tr').first()).toBeVisible();
});

test('Master journey: login → /admin → /parking → globe switches language', async ({ page }) => {
  await loginAs(page, MASTER_USER, MASTER_PASS);
  await page.waitForURL(/\/admin/, { timeout: 20_000 });
  await waitForAppReady(page, 'admin');

  await expect(page.locator('.user-chip')).toBeVisible({ timeout: 5_000 });

  await page.locator('nav.site-nav a[href*="parking"]').click();
  await page.waitForURL(/\/parking/, { timeout: 10_000 });
  await waitForAppReady(page, 'renter');

  await expect(page.locator('#parking-svg g[data-id]').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('nav.site-nav a[href*="admin"]').first()).toBeVisible({ timeout: 5_000 });

  // Globe dropdown: open → pick DE → pick EN
  const globeBtn = page.locator('.lang-globe-btn').first();
  await expect(globeBtn).toBeVisible();
  await globeBtn.click();
  await expect(page.locator('.lang-globe-dropdown')).toBeVisible({ timeout: 3_000 });
  await page.locator('.lang-globe-dropdown button[data-lang="de"]').click();
  await expect(globeBtn).toContainText('DE', { timeout: 3_000 });

  await globeBtn.click();
  await page.locator('.lang-globe-dropdown button[data-lang="en"]').click();
  await expect(globeBtn).toContainText('EN', { timeout: 3_000 });
});

test('Renter journey: login → /parking → no Admin link → profile → logout visible', async ({ page }) => {
  await loginAs(page, RENTER_USER, RENTER_PASS);
  await page.waitForURL(/\/parking/, { timeout: 20_000 });
  await waitForAppReady(page, 'renter');

  await expect(page.locator('#parking-svg g[data-id]').first()).toBeVisible({ timeout: 10_000 });

  // Admin link must NOT be visible for renter
  await expect(page.locator('nav.site-nav a[href*="admin"]')).toBeHidden({ timeout: 3_000 });

  await expect(page.locator('.user-chip')).toBeVisible({ timeout: 5_000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.bottom-nav a[href*="admin"]')).toBeHidden();

  // Navigate to incidents via bottom nav
  await page.locator('.bottom-nav a[href*="incident"]').click();
  await page.waitForURL(/\/incident/, { timeout: 10_000 });
  await expect(page.locator('nav.site-nav a[href*="admin"]')).toBeHidden({ timeout: 3_000 });
});
