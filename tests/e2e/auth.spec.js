// tests/e2e/auth.spec.js
import { test, expect } from '@playwright/test';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';
const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test.describe('Login', () => {
  test('correct admin credentials → redirects to admin.html', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill(ADMIN_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/admin\.html/, { timeout: 15_000 });
  });

  test('correct renter credentials → redirects to parking.html', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(RENTER_USER);
    await page.locator('#password').fill(RENTER_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/parking\.html/, { timeout: 15_000 });
  });

  test('wrong password → shows error, stays on login page', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill('WRONG_PASSWORD');
    await page.click('button[type="submit"]');
    await expect(page.locator('#error, .error, .toast-error, [role="alert"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/admin\.html|parking\.html/);
  });

  test('unknown username → shows error', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill('XX-ZZ-999');
    await page.locator('#password').fill('anything');
    await page.click('button[type="submit"]');
    await expect(page.locator('#error, .error, .toast-error, [role="alert"]').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Session persistence', () => {
  test('after login, refreshing the page keeps the session', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill(ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin\.html/, { timeout: 15_000 });
    await page.reload();
    await expect(page).toHaveURL(/admin\.html/);
  });
});

test.describe('Logout', () => {
  test('logout button → redirects to index.html, session cleared', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill(ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin\.html/, { timeout: 15_000 });
    await page.locator('#logout-link, [data-i18n="nav.logout"], button:has-text("Logout"), a:has-text("Logout")').first().click();
    await expect(page).toHaveURL(/index\.html|^http:\/\/localhost:3000\/?$/, { timeout: 10_000 });
    await page.goto('/admin.html');
    await expect(page).toHaveURL(/index\.html/, { timeout: 10_000 });
  });
});

test.describe('Auth guard', () => {
  test('navigating to parking.html without login → redirected to index.html', async ({ page }) => {
    await page.goto('/parking.html');
    await expect(page).toHaveURL(/index\.html/, { timeout: 10_000 });
  });

  test('navigating to admin.html without login → redirected to index.html', async ({ page }) => {
    await page.goto('/admin.html');
    await expect(page).toHaveURL(/index\.html/, { timeout: 10_000 });
  });
});
