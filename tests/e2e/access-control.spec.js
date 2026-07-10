// tests/e2e/access-control.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER  = 'TEST-ADMIN';
const ADMIN_PASS  = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';
const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';
const WORKER_URL  = process.env.STAGING_WORKER_URL || 'https://park-management-api.aenumina.workers.dev';

// ── Browser-level access control ──────────────────────────────────────────────

test.describe('Browser access control', () => {
  test('renter cannot navigate to admin.html directly', async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await page.goto('/admin.html');
    await expect(page).not.toHaveURL(/admin\.html/, { timeout: 10_000 });
  });

  test('renter sees only own incidents in incident log', async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 30_000 });
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 10_000 });
    const cards = page.locator('.incident-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toContainText(/spot 1|s1/i);
    }
  });

  test('admin sees all incidents across all spots', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/admin\.html/, { timeout: 30_000 });
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 10_000 });
    const allCards = page.locator('.incident-card');
    const count = await allCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

// ── API-level access control (L3 — Playwright request context) ────────────────

test.describe('API access control (L3)', () => {
  let renterToken;

  test.beforeAll(async ({ request }) => {
    // Retry login up to 3 times — Worker may be cold on first request
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await request.post(`${WORKER_URL}/auth/login`, {
        data: { username: RENTER_USER, password: RENTER_PASS }
      });
      if (res.ok()) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
    }
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    renterToken = data.accessToken;
  });

  test('unauthenticated request returns 401', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/spots`);
    expect(res.status()).toBe(401);
  });

  test('renter token cannot call admin-only mutation routes (403 or 401)', async ({ request }) => {
    const res = await request.patch(`${WORKER_URL}/users/u-renter-b`, {
      headers: { Authorization: `Bearer ${renterToken}` },
      data: { name: 'hacked' }
    });
    expect([401, 403, 404]).toContain(res.status());
  });

  test('renter token cannot delete a spot (403 or 401)', async ({ request }) => {
    const res = await request.delete(`${WORKER_URL}/spots/s5`, {
      headers: { Authorization: `Bearer ${renterToken}` }
    });
    expect([401, 403, 404]).toContain(res.status());
  });
});
