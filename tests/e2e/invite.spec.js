// tests/e2e/invite.spec.js
import { test, expect } from '@playwright/test';

test.describe('Invite token validation', () => {
  test('valid token → registration form loads', async ({ page }) => {
    await page.goto('/invite.html?token=VALID-TOKEN-FOR-E2E');
    // invite-content is shown when token is valid
    await expect(page.locator('#invite-content')).toBeVisible({ timeout: 10_000 });
  });

  test('expired token → error shown, form hidden', async ({ page }) => {
    await page.goto('/invite.html?token=EXPIRED-TOKEN-FOR-E2E');
    await expect(page.locator('#invite-status.error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#invite-content')).not.toBeVisible();
  });

  test('used token → error shown', async ({ page }) => {
    await page.goto('/invite.html?token=USED-TOKEN-FOR-E2E');
    await expect(page.locator('#invite-status.error')).toBeVisible({ timeout: 10_000 });
  });

  test('nonexistent token → error shown', async ({ page }) => {
    await page.goto('/invite.html?token=NONEXISTENT-TOKEN-XYZ');
    await expect(page.locator('#invite-status.error')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Registration form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/invite.html?token=VALID-TOKEN-FOR-E2E');
    await expect(page.locator('#invite-content')).toBeVisible({ timeout: 10_000 });
  });

  test('invalid license plate → validation error shown', async ({ page }) => {
    // Fill required fields with an invalid username (no license plate field — username is the plate)
    await page.locator('#r-username').fill('INVALID PLATE!!');
    await page.locator('#r-password').fill('TestPass123!');
    await page.locator('#r-name').fill('Test User');
    await page.locator('#register-form button[type="submit"]').click();
    await expect(page.locator('#reg-msg, .error, [class*="error"]').first()).toBeVisible({ timeout: 5_000 });
  });
});
