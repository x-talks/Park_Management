// tests/e2e/register.spec.js
import { test, expect } from '@playwright/test';

// Seed tokens: valid-token-s7 (valid, spot 7, David Prospect HD-GG-007)
// expired-token (expired), used-token (already used)

test.describe('register.html — token validation', () => {
  test('valid token shows step 1 (Review) as active', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#si-1.active')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#step-terms')).toBeVisible({ timeout: 10_000 });
  });

  test('invalid token shows error, hides step indicator', async ({ page }) => {
    await page.goto('/register.html?token=does-not-exist-xyz');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#step-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#step-indicator')).not.toBeVisible({ timeout: 5_000 });
  });

  test('expired token shows error message', async ({ page }) => {
    await page.goto('/register.html?token=expired-token');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#error-msg')).toContainText(/expired/i, { timeout: 10_000 });
  });

  test('used token shows error message', async ({ page }) => {
    await page.goto('/register.html?token=used-token');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#error-msg')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('register.html — step progression', () => {
  test('clicking I Agree advances to step 2 (Register)', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#step-terms')).toBeVisible({ timeout: 10_000 });
    await page.locator('#agree-btn').click();
    await expect(page.locator('#step-register')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#si-2.active')).toBeVisible({ timeout: 5_000 });
  });

  test('prefill table shows invite data', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#prefill-table')).toContainText('David', { timeout: 10_000 });
    await expect(page.locator('#prefill-table')).toContainText('Prospect');
  });

  test('spot badge shows correct spot label', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#spot-label-display')).toContainText('7', { timeout: 10_000 });
  });

  test('payment notice is visible with euro amount', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#payment-notice')).toContainText(/€/, { timeout: 10_000 });
  });

  test('prefilled plate field is readonly', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    await page.locator('#agree-btn').click();
    await expect(page.locator('#step-register')).toBeVisible({ timeout: 5_000 });
    const plateInput = page.locator('#r-plate');
    await expect(plateInput).toHaveValue('HD-GG-007');
    expect(await plateInput.getAttribute('readonly')).not.toBeNull();
  });

  test('submit registration → step 3 done shown', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    await page.locator('#agree-btn').click();
    await expect(page.locator('#step-register')).toBeVisible({ timeout: 5_000 });
    await page.locator('#r-password').fill('NewPass123!');
    await page.locator('#register-form button[type=submit]').click();
    await page.waitForTimeout(5000);
    await expect(page.locator('#step-done')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#done-username')).toContainText('HD-GG-007');
  });
});
