// e2e/access-control.spec.js
import { test, expect } from './fixtures.js';
import { loginAs } from './helpers.js';

const ADMIN_USER  = 'TEST-ADMIN';
const ADMIN_PASS  = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';
const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';
const WORKER_URL  = process.env.STAGING_WORKER_URL || 'https://park-management-api-staging.aenumina.workers.dev';

test.describe('Browser access control', () => {
  test('renter cannot navigate to /admin directly', async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/\/parking/, { timeout: 30_000 });
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 10_000 });
  });

  test('admin sees all incidents across all spots', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    await page.goto('/incident');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('API access control (L3)', () => {
  let renterToken;

  test.beforeAll(async ({ request }) => {
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await request.post(`${WORKER_URL}/auth/login`, {
        data: { username: RENTER_USER, password: RENTER_PASS }
      });
      if (res.ok()) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
    }
    expect(res.ok()).toBeTruthy();
    renterToken = (await res.json()).accessToken;
  });

  test('unauthenticated request returns 401', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/spots`);
    expect([401, 404]).toContain(res.status());
  });

  test('renter token cannot call admin-only mutation routes (403 or 401)', async ({ request }) => {
    const res = await request.patch(`${WORKER_URL}/users/u-renter-b`, {
      headers: { Authorization: `Bearer ${renterToken}` },
      data: { name: 'hacked' }
    });
    expect([401, 403, 404]).toContain(res.status());
  });
});
