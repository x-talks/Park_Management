// tests/e2e/journey.spec.js
// Full click-through journey test covering all pages and nav for both admin and renter.
// Catches regressions like: missing map on admin nav, missing Admin link, broken bottom nav.
import { test, expect } from './fixtures.js';
import { loginAs, waitForAppReady } from './helpers.js';

// Journey tests do login + multi-page navigation; give them more room than the 35s global timeout.
test.setTimeout(90_000);

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';
const MASTER_USER = 'TEST-MASTER';
const MASTER_PASS = process.env.STAGING_MASTER_PASSWORD || 'ParkManagement123!';
const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

// ── Admin journey ─────────────────────────────────────────────────────────────

test('Admin journey: login → lands on admin.html → nav to Map → Admin link visible → nav to Incidents → Admin link visible → back to Admin', async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 20_000 });
  await waitForAppReady(page, 'admin');

  // User chip visible in header
  await expect(page.locator('.user-chip')).toBeVisible({ timeout: 5_000 });

  // Globe lang switcher present
  await expect(page.locator('.lang-globe-btn')).toBeVisible();

  // ── Navigate to Map ──────────────────────────────────────────────────────
  await page.locator('nav.site-nav a[href="parking.html"]').click();
  await page.waitForURL(/parking\.html/, { timeout: 10_000 });
  await waitForAppReady(page, 'renter');

  // Map SVG rendered with spots
  await expect(page.locator('#parking-svg g[data-id]').first()).toBeVisible({ timeout: 10_000 });

  // Admin link must be visible in top nav for admin users
  await expect(page.locator('nav.site-nav #admin-link')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('nav.site-nav #admin-link a')).toBeVisible();

  // On mobile viewport, bottom nav has Admin tab
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.bottom-nav a[href="admin.html"]')).toBeVisible({ timeout: 5_000 });
  await page.setViewportSize({ width: 1280, height: 720 });

  // User chip still visible
  await expect(page.locator('.user-chip')).toBeVisible();

  // ── Navigate to Incidents ────────────────────────────────────────────────
  await page.locator('nav.site-nav a[href="incident.html"]').click();
  await page.waitForURL(/incident\.html/, { timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');

  // Admin link must be visible on incidents page too
  await expect(page.locator('nav.site-nav #admin-link')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('nav.site-nav #admin-link a')).toBeVisible();

  // Logout icon button present (⎋)
  await expect(page.locator('#logout-link')).toBeVisible();

  // User chip still visible
  await expect(page.locator('.user-chip')).toBeVisible();

  // ── Navigate back to Admin ───────────────────────────────────────────────
  await page.locator('nav.site-nav #admin-link a').click();
  await page.waitForURL(/admin\.html/, { timeout: 10_000 });
  await waitForAppReady(page, 'admin');
  await expect(page.locator('#user-list table tr').first()).toBeVisible();
});

// ── Master journey ────────────────────────────────────────────────────────────

test('Master journey: login → admin page → map shows → admin link visible → globe dropdown switches language', async ({ page }) => {
  await loginAs(page, MASTER_USER, MASTER_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 20_000 });
  await waitForAppReady(page, 'admin');

  // Master chip has amber/gold color class
  await expect(page.locator('.user-chip.chip-master')).toBeVisible({ timeout: 5_000 });

  // Navigate to Map
  await page.locator('nav.site-nav a[href="parking.html"]').click();
  await page.waitForURL(/parking\.html/, { timeout: 10_000 });
  await waitForAppReady(page, 'renter');

  await expect(page.locator('#parking-svg g[data-id]').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('nav.site-nav #admin-link')).toBeVisible({ timeout: 5_000 });

  // Globe dropdown: open → pick DE → label updates → pick EN → label updates
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

// ── Renter journey ────────────────────────────────────────────────────────────

test('Renter journey: login → lands on parking.html → map visible → no Admin link → profile tab → logout button visible', async ({ page }) => {
  await loginAs(page, RENTER_USER, RENTER_PASS);
  await page.waitForURL(/parking\.html/, { timeout: 20_000 });
  await waitForAppReady(page, 'renter');

  // Map rendered
  await expect(page.locator('#parking-svg g[data-id]').first()).toBeVisible({ timeout: 10_000 });

  // Admin link must NOT be visible for renter
  await expect(page.locator('nav.site-nav #admin-link')).toBeHidden({ timeout: 3_000 });

  // Renter chip visible
  await expect(page.locator('.user-chip.chip-renter')).toBeVisible({ timeout: 5_000 });

  // Switch to mobile viewport for bottom nav interactions
  await page.setViewportSize({ width: 390, height: 844 });

  // Bottom nav has no Admin tab
  await expect(page.locator('.bottom-nav a[href="admin.html"]')).toBeHidden();

  // Navigate to profile via bottom nav
  await page.locator('.bottom-nav a[href="profile.html"]').click();
  await page.waitForURL(/profile\.html/, { timeout: 10_000 });

  // Profile card rendered
  await expect(page.locator('#profile-card')).toBeVisible({ timeout: 5_000 });

  // Logout button always in nav controls (not in profile card anymore)
  await expect(page.locator('#logout-link')).toBeVisible({ timeout: 3_000 });

  // Incidents nav works
  await page.locator('.bottom-nav a[href="incident.html"]').click();
  await page.waitForURL(/incident\.html/, { timeout: 10_000 });
  await page.waitForLoadState('domcontentloaded');
  // No Admin link for renter on incidents page
  await expect(page.locator('nav.site-nav #admin-link')).toBeHidden({ timeout: 3_000 });
});
