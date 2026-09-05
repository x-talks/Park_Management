// tests/e2e/profile.spec.js — Bug 9: profile.html as standalone page with password change
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';
const ADMIN_USER  = 'TEST-ADMIN';
const ADMIN_PASS  = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.describe('profile.html — page structure', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await page.goto('/profile.html');
    await page.waitForURL(/profile\.html/, { timeout: 10_000 });
  });

  test('profile page loads and shows personal info form', async ({ page }) => {
    await expect(page.locator('#profile-card')).toBeVisible({ timeout: 10_000 });
  });

  test('plate field is pre-filled and read-only', async ({ page }) => {
    const plate = page.locator('#p-plate');
    await expect(plate).toBeVisible({ timeout: 10_000 });
    const val = await plate.inputValue();
    expect(val.trim().length).toBeGreaterThan(0);
    expect(await plate.getAttribute('readonly')).not.toBeNull();
  });

  test('first name and last name are read-only', async ({ page }) => {
    await expect(page.locator('#p-name')).toBeVisible({ timeout: 10_000 });
    expect(await page.locator('#p-name').getAttribute('readonly')).not.toBeNull();
    expect(await page.locator('#p-lastname').getAttribute('readonly')).not.toBeNull();
  });

  test('phone and address fields are editable', async ({ page }) => {
    const phone = page.locator('#p-phone');
    await expect(phone).toBeVisible({ timeout: 10_000 });
    expect(await phone.getAttribute('readonly')).toBeNull();
    expect(await page.locator('#p-address').getAttribute('readonly')).toBeNull();
  });

  test('password change form is present with all three fields', async ({ page }) => {
    await expect(page.locator('#password-form')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#pw-current')).toBeVisible();
    await expect(page.locator('#pw-new')).toBeVisible();
    await expect(page.locator('#pw-confirm')).toBeVisible();
  });

  test('bottom nav contains profile link marked active', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const activeLink = page.locator('.bottom-nav a.active');
    await expect(activeLink).toBeVisible({ timeout: 5_000 });
    const href = await activeLink.getAttribute('href');
    expect(href).toMatch(/profile\.html/);
  });
});

test.describe('profile.html — password change validation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await page.goto('/profile.html');
    await page.waitForURL(/profile\.html/, { timeout: 10_000 });
    await expect(page.locator('#password-form')).toBeVisible({ timeout: 10_000 });
  });

  test('mismatched passwords shows error, does not submit', async ({ page }) => {
    await page.locator('#pw-current').fill('SomePass123!');
    await page.locator('#pw-new').fill('NewPass123!');
    await page.locator('#pw-confirm').fill('Different456!');
    await page.locator('#password-form button[type=submit]').click();
    // pw-msg should show mismatch error — no network call needed
    await expect(page.locator('#pw-msg')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('#pw-msg')).not.toBeEmpty();
  });

  test('password shorter than 8 chars shows error', async ({ page }) => {
    await page.locator('#pw-current').fill('SomePass123!');
    await page.locator('#pw-new').fill('short');
    await page.locator('#pw-confirm').fill('short');
    await page.locator('#password-form button[type=submit]').click();
    await expect(page.locator('#pw-msg')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('#pw-msg')).not.toBeEmpty();
  });

  test('wrong current password returns error from worker', async ({ page }) => {
    await page.locator('#pw-current').fill('WrongCurrentPass999!');
    await page.locator('#pw-new').fill('NewValidPass123!');
    await page.locator('#pw-confirm').fill('NewValidPass123!');
    await page.locator('#password-form button[type=submit]').click();
    // Worker should reject — error displayed in #pw-msg
    await expect(page.locator('#pw-msg')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#pw-msg')).not.toBeEmpty();
  });
});

test.describe('profile.html — accessible from nav on all pages', () => {
  test('parking.html top nav has Profile link pointing to profile.html', async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    const link = page.locator('.nav-links a[href*="profile.html"]');
    await expect(link).toBeVisible({ timeout: 10_000 });
  });

  test('incident.html top nav has Profile link pointing to profile.html', async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await page.goto('/incident.html');
    const link = page.locator('.nav-links a[href*="profile.html"]');
    await expect(link).toBeVisible({ timeout: 10_000 });
  });

  test('admin top nav has Profile link', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/admin\.html/, { timeout: 30_000 });
    const link = page.locator('.nav-links a[href*="profile.html"]');
    await expect(link).toBeVisible({ timeout: 10_000 });
  });
});
