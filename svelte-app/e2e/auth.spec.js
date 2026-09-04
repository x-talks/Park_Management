// e2e/auth.spec.js
import { test, expect } from '@playwright/test';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';
const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test.describe('Login', () => {
  test('correct admin credentials → redirects to /admin', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill(ADMIN_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  });

  test('correct renter credentials → redirects to /parking', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(RENTER_USER);
    await page.locator('#password').fill(RENTER_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/parking/, { timeout: 15_000 });
  });

  test('wrong password → shows error, stays on login page', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill('WRONG_PASSWORD');
    await page.click('button[type="submit"]');
    await expect(page.locator('#error, .error, .toast-error, [role="alert"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/admin|\/parking/);
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
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    await page.reload();
    await expect(page).toHaveURL(/\/admin/);
  });
});

test.describe('Logout', () => {
  test('logout button → redirects to /, session cleared', async ({ page }) => {
    await page.goto('/');
    await page.locator('#username').fill(ADMIN_USER);
    await page.locator('#password').fill(ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    await page.locator('#logout-link, [data-i18n="nav.logout"], button:has-text("Logout"), a:has-text("Logout")').first().click();
    await expect(page).toHaveURL(/^\s*http:\/\/localhost:4173\/?$/, { timeout: 10_000 });
    await page.goto('/admin');
    await expect(page).toHaveURL(/^\s*http:\/\/localhost:4173\/?$/, { timeout: 10_000 });
  });
});

test.describe('Auth guard', () => {
  test('navigating to /parking without login → redirected to /', async ({ page }) => {
    await page.goto('/parking');
    await expect(page).toHaveURL(/^\s*http:\/\/localhost:4173\/?$/, { timeout: 10_000 });
  });

  test('navigating to /admin without login → redirected to /', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/^\s*http:\/\/localhost:4173\/?$/, { timeout: 10_000 });
  });
});
