// e2e/admin-mutations.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
});

const waitForUserList = (page) =>
  page.waitForFunction(
    () => document.getElementById('user-list') && document.getElementById('user-list').querySelector('table tr'),
    { timeout: 30_000 }
  );

// ── Pending registration ──────────────────────────────────────────────────────

test.describe('Pending registration', () => {
  test('approve pending registration HD-DD-004 → user appears in user list', async ({ page }) => {
    await waitForUserList(page);
    const pendingRow = page.locator('#pending-reg-list tr').filter({ hasText: 'HD-DD-004' }).first();
    if (await pendingRow.count() === 0) return; // already processed
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    await pendingRow.locator('button[title="Approve"]').first().click();
    await page.waitForTimeout(4000);
    await expect(page.locator('#user-list')).toContainText('HD-DD-004', { timeout: 20_000 });
  });

  test('reject pending registration → row removed from pending list', async ({ page }) => {
    await waitForUserList(page);
    const rowCount = await page.locator('#pending-reg-list tr').filter({ hasText: 'HD-DD-004' }).count();
    if (rowCount === 0) return;
    const pendingRow = page.locator('#pending-reg-list tr').filter({ hasText: 'HD-DD-004' }).first();
    await pendingRow.locator('button[title="Reject"]').first().click();
    await page.locator('#pm-modal-confirm').click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#pending-reg-list')).not.toContainText('HD-DD-004');
  });
});

// ── User activate/deactivate ──────────────────────────────────────────────────

test.describe('User activate/deactivate', () => {
  test('deactivate renter HD-CC-003 → row shows inactive state', async ({ page }) => {
    await waitForUserList(page);
    const row = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    if (await row.locator('button[title="Activate"]').count() > 0) {
      await expect(row).toContainText(/inactive/i);
      return;
    }
    await row.locator('button[title="Deactivate"]').first().click();
    await page.waitForTimeout(2000);
    const updated = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(updated).toContainText(/inactive/i);
  });

  test('activate renter HD-CC-003 → row shows active state', async ({ page }) => {
    await waitForUserList(page);
    const row = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    if (await row.locator('button[title="Deactivate"]').count() > 0) {
      await expect(row).not.toContainText(/inactive/i);
      return;
    }
    await row.locator('button[title="Activate"]').first().click();
    await page.waitForTimeout(2000);
    const updated = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(updated).not.toContainText(/inactive/i);
  });
});

// ── Generate invite ────────────────────────────────────────────────────────────

test.describe('Generate invite', () => {
  test('fill invite form → invite URL is displayed', async ({ page }) => {
    await waitForUserList(page);
    await page.locator('#cu-fname').fill('Test');
    await page.locator('#cu-lname').fill('Invitee');
    await page.locator('#cu-phone').fill('+49300000099');
    await page.locator('#cu-address').fill('Test Street 99');
    // Don't assign a spot — it may be occupied after prior test mutations
    await page.locator('#cu-plate').fill('HD-ZZ-099');
    await page.locator('#cu-model').fill('Test Car');
    await page.locator('#cu-color').fill('white');
    // Scroll submit button into view before clicking
    const submitBtn = page.locator('#cu-fname').locator('xpath=ancestor::form').locator('button[type=submit]');
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();
    // Wait for either success (invite-result-box) or error (toast); timeout 30s covers cold worker
    await Promise.race([
      page.locator('.invite-result-box').waitFor({ state: 'visible', timeout: 30_000 }),
      page.locator('.pm-toast-error').waitFor({ state: 'visible', timeout: 30_000 }),
    ]).catch(() => {});
    await expect(page.locator('.pm-toast-error')).not.toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.invite-result-box')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.invite-url')).not.toBeEmpty();
  });

  test('selecting a spot auto-fills monthly rent field', async ({ page }) => {
    await waitForUserList(page);
    const spotSelect = page.locator('#cu-spot');
    const rentField  = page.locator('#cu-rent');
    await expect(rentField).toBeVisible({ timeout: 10_000 });
    await spotSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    const rentVal = await rentField.inputValue();
    expect(rentVal.trim().length).toBeGreaterThan(0);
    expect(await rentField.getAttribute('readonly')).toBeNull();
    await rentField.fill('120');
    await expect(rentField).toHaveValue('120');
  });
});

// ── Spot assignment ────────────────────────────────────────────────────────────

test.describe('Spot assign/unassign', () => {
  test('assign free spot s8 to renter HD-BB-002 → Unassign button appears', async ({ page }) => {
    await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
    await page.locator('#tab-btn-spots').click();
    await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s8Row = page.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    await expect(s8Row).toBeVisible({ timeout: 10_000 });
    // If already assigned, unassign first
    if (await s8Row.locator('button[title="Unassign"]').count() > 0) {
      await s8Row.locator('button[title="Unassign"]').first().click();
      const confirmBtn = page.locator('#pm-modal-confirm');
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      await confirmBtn.click();
      await expect(confirmBtn).not.toBeVisible({ timeout: 5_000 });
      await expect(page.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ })
        .first().locator('select')).toBeVisible({ timeout: 10_000 });
    }
    const s8Fresh = page.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    const s8Sel = s8Fresh.locator('select').first();
    // Get the option value for HD-BB-002, then use selectOption to trigger Svelte binding
    const s8OptValue = await s8Sel.evaluate((sel, plate) => {
      const opt = Array.from(sel.options).find(o => o.textContent.includes(plate));
      return opt ? opt.value : '';
    }, 'HD-BB-002');
    if (!s8OptValue) throw new Error('HD-BB-002 option not found in select');
    // Use Playwright selectOption (triggers DOM change event picked up by Svelte bind:value)
    await s8Sel.selectOption({ value: s8OptValue });
    await s8Fresh.locator('button[title="Assign"]').first().click();
    // Ensure no error toast (would indicate API failure)
    await expect(page.locator('.pm-toast-error')).not.toBeVisible({ timeout: 3_000 });
    // Wait reactively for the Unassign button to appear (up to 15s)
    const s8After = page.locator('#spot-list table tr').filter({ hasText: /^8[^0-9]/ }).first();
    await expect(s8After.locator('button[title="Unassign"]')).toBeVisible({ timeout: 15_000 });
  });

  test('unassign s1 → spot becomes free', async ({ page }) => {
    await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
    await page.locator('#tab-btn-spots').click();
    await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    await s1Row.locator('button[title="Unassign"]').first().click();
    // Wait for modal to fully render before clicking confirm
    const confirmBtn = page.locator('#pm-modal-confirm');
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.waitFor({ state: 'visible' });
    await confirmBtn.click();
    // Modal should close after confirm
    await expect(confirmBtn).not.toBeVisible({ timeout: 5_000 });
    // Wait reactively for the unassign button to disappear (up to 15s for Worker + refresh)
    const s1After = page.locator('#spot-list table tr').filter({ hasText: /^1[^0-9]/ }).first();
    await expect(s1After.locator('button[title="Unassign"]')).toHaveCount(0, { timeout: 15_000 });
    // Restore state
    try {
      const s1Free = page.locator('#spot-list table tr').filter({ hasText: /^1[^0-9]/ }).first();
      const s1Sel = s1Free.locator('select').first();
      const s1OptValue = await s1Sel.evaluate((sel, plate) => {
        const opt = Array.from(sel.options).find(o => o.textContent.includes(plate));
        return opt ? opt.value : '';
      }, 'HD-AA-001');
      await s1Sel.selectOption(s1OptValue);
      await s1Free.locator('button[title="Assign"]').first().click();
      await page.waitForTimeout(2000);
    } catch (e) { console.warn('State restore s1:', e.message); }
  });
});

// ── Spot reserve/unreserve ─────────────────────────────────────────────────────

test.describe('Spot reserve/unreserve', () => {
  test('reserve free spot s5 → spot shows Reserved', async ({ page }) => {
    await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
    await page.locator('#tab-btn-spots').click();
    await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s5Row = page.locator('#spot-list table tr').filter({ hasText: /^5[^0-9]/ }).first();
    await s5Row.locator('button[title="Mark reserved"]').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#spot-list table tr').filter({ hasText: /reserved/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('unreserve s3 → spot no longer shows Reserved', async ({ page }) => {
    await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 20_000 });
    await page.locator('#tab-btn-spots').click();
    await expect(page.locator('#spot-list table tr').nth(1)).toBeVisible({ timeout: 30_000 });
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
    await expect(s3Row).toBeVisible({ timeout: 10_000 });
    const unreserveBtn = s3Row.locator('button[title="Unreserve"]');
    if (await unreserveBtn.count() === 0) return;
    await unreserveBtn.first().click();
    await page.waitForTimeout(2000);
    const s3After = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
    await expect(s3After).not.toContainText(/reserved/i);
    // Restore state
    try {
      const s3Fresh = page.locator('#spot-list table tr').filter({ hasText: /^3[^0-9]/ }).first();
      await s3Fresh.locator('button[title="Mark reserved"]').first().click();
      await page.locator('#pm-modal-confirm').click();
      await expect(s3Fresh).toContainText(/reserved/i, { timeout: 10_000 });
    } catch (e) { console.warn('State restore s3:', e.message); }
  });
});
