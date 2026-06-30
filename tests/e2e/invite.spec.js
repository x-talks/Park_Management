// tests/e2e/invite.spec.js
import { test, expect } from '@playwright/test';

test.describe('Invite token validation', () => {
  test('valid token → registration form loads', async ({ page }) => {
    await page.goto('/invite.html?token=VALID-TOKEN-FOR-E2E');
    await expect(page.locator('form, #reg-form, .reg-step').first()).toBeVisible({ timeout: 10_000 });
  });

  test('expired token → error shown, form hidden', async ({ page }) => {
    await page.goto('/invite.html?token=EXPIRED-TOKEN-FOR-E2E');
    await expect(page.locator('.error, .toast-error, [class*="error"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('form, #reg-form')).not.toBeVisible();
  });

  test('used token → error shown', async ({ page }) => {
    await page.goto('/invite.html?token=USED-TOKEN-FOR-E2E');
    await expect(page.locator('.error, .toast-error, [class*="error"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('nonexistent token → error shown', async ({ page }) => {
    await page.goto('/invite.html?token=NONEXISTENT-TOKEN-XYZ');
    await expect(page.locator('.error, .toast-error, [class*="error"]').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Registration form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/invite.html?token=VALID-TOKEN-FOR-E2E');
    await page.waitForSelector('form, #reg-form, .reg-step', { timeout: 10_000 });
    // Accept terms if step 1 requires it
    const agreeBtn = page.locator('[data-i18n="reg.btn.agree"], button:has-text("Agree"), button:has-text("Proceed")');
    if (await agreeBtn.count() > 0) await agreeBtn.first().click();
    await page.waitForTimeout(500);
  });

  test('invalid license plate → validation error shown', async ({ page }) => {
    await page.locator('input[name="plate"], #reg-plate').first().fill('INVALID-PLATE');
    await page.locator('input[type="password"]').first().fill('TestPass123!');
    await page.locator('button[type="submit"], [data-i18n="reg.btn.submit"]').first().click();
    await expect(page.locator('.error, [class*="error"], .toast-error').first()).toBeVisible({ timeout: 5_000 });
  });
});
