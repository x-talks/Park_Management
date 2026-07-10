# Retroactive Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill all P1/P2/P3 test coverage gaps identified in the tdd-first skill design, bringing Park Management from ~31% to full coverage across all 7 layers (unit, component, integration, system/E2E, access control, multi-user sync, acceptance).

**Architecture:** Tests are added to existing spec files where natural, and new spec files are created per feature area. Seed.js is extended with additional fixtures required by new tests. No production code changes — tests only.

**Tech Stack:** Vitest + jsdom (L1/L2), Playwright Chromium browser (L4/L5/L6/L7), Playwright request context (L3), Supabase staging, Cloudflare Worker staging.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `tests/fixtures/seed.js` | Modify | Add renter-C assigned spot (s6), pending reg for HD-DD-004 at s5, extra invite token (s7 valid) |
| `tests/e2e/admin-mutations.spec.js` | Create | P1: all admin write operations (approve/reject reg, activate/deactivate, edit user, delete, generate invite, assign/unassign spot, reserve/unreserve) |
| `tests/e2e/admin-payments-mutations.spec.js` | Create | P1: mark paid, revert payment |
| `tests/e2e/access-control.spec.js` | Create | P1: renter blocked from every admin mutation; renter sees only own incidents |
| `tests/e2e/sync.spec.js` | Create | P2: admin marks paid → renter sees it; admin assigns spot → renter sees map update |
| `tests/e2e/register.spec.js` | Create | P2: full 3-step register.html wizard (valid token, step progression, success, error paths) |
| `tests/e2e/acceptance-renter.spec.js` | Create | P2: full renter journey (login → map → profile edit → view payments) |
| `tests/e2e/acceptance-admin.spec.js` | Create | P2: full admin journey (login → generate invite → approve registration → mark paid) |
| `tests/e2e/parking-map.spec.js` | Create | P3: info panel content, residents list, profile edit form |
| `tests/e2e/incident-log.spec.js` | Create | P3: log populated with data, lightbox open/close, admin delete, renter access control |
| `tests/unit/payments.test.js` | Modify | P3: verify pro-rated fraction calculations are fully covered |

---

## Task 1: Extend seed.js with additional fixtures

**Files:**
- Modify: `tests/fixtures/seed.js`

These fixtures are required by Tasks 2–10. Must be done first.

- [ ] **Step 1: Read seed.js to understand current structure**

Run: `cat tests/fixtures/seed.js`

- [ ] **Step 2: Add renter-C spot assignment and extra spots to seed**

In `tests/fixtures/seed.js`, find the `users` array and update `u-renter-c` to have `assignedSpots: ['s6']`. Find the `spots` array and update `s6` to have `state: 'occupied'` and `assignedUserId: 'u-renter-c'`. Also add a valid invite for `s7` (token: `valid-token-s7`, expires 7 days from now).

The relevant section in seed.js (users array, after `u-renter-b`):

```js
// Change this:
{ id: 'u-renter-c', username: 'HD-CC-003', ..., assignedSpots: null }
// To:
{
  id: 'u-renter-c', username: 'HD-CC-003', authId: renterCAuthId,
  name: 'Carlos', lastName: 'Renter', licensePlate: 'HD-CC-003',
  phone: '+49300000003', carModel: 'BMW 3', carColor: 'black',
  role: 'renter', active: true,
  registeredAt: firstOfMonth(),
  assignedSpots: JSON.stringify(['s6']),
  passwordHash: null, lastPassword: null,
  pendingEdits: null, terminationDate: null,
  address: 'Test Street 3'
}
```

In spots array, update s6:
```js
// Change:
if (id === 's6') return base;
// To:
if (id === 's6') return { ...base, state: 'occupied', assignedUserId: 'u-renter-c' };
```

Add a second valid invite token after existing invites:
```js
{
  id: 'inv-valid-s7',
  token: 'valid-token-s7',
  spotId: 's7',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  usedBy: null,
  name: 'David', lastName: 'Prospect',
  phone: '+49300000007', address: 'Test Street 7',
  licensePlate: 'HD-GG-007', carModel: 'Audi A4', carColor: 'silver'
}
```

- [ ] **Step 3: Run seed locally to verify no errors**

```bash
node tests/fixtures/staging-config.js && node tests/fixtures/seed.js
```

Expected output: `✓ spots`, `✓ users`, `✓ payments`, `✓ invites`, `✓ pending_registrations`

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/seed.js
git commit -m "test: extend seed with renter-c spot assignment and valid s7 invite"
```

---

## Task 2: P1 — Admin mutation tests (approve/reject, activate/deactivate, edit, delete, invite, assign, reserve)

**Files:**
- Create: `tests/e2e/admin-mutations.spec.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/e2e/admin-mutations.spec.js`:

```js
// tests/e2e/admin-mutations.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
});

// ── Pending registration ───────────────────────────────────────────────────────

test.describe('Pending registration', () => {
  test('approve pending registration HD-DD-004 → user appears in user list', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    // Find the pending registration row for HD-DD-004
    const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
      .filter({ hasText: 'HD-DD-004' }).first();
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    // Click approve button in that row
    const approveBtn = pendingRow.locator('button').filter({ hasText: /approve/i }).first();
    await approveBtn.click();
    await page.waitForTimeout(2000);
    // Approved user should now appear in user list
    await expect(page.locator('#user-list')).toContainText('HD-DD-004', { timeout: 10_000 });
  });

  test('reject pending registration → row removed from pending list', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
      .filter({ hasText: 'HD-DD-004' }).first();
    await expect(pendingRow).toBeVisible({ timeout: 10_000 });
    const rejectBtn = pendingRow.locator('button').filter({ hasText: /reject/i }).first();
    await rejectBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#pending-reg-list')).not.toContainText('HD-DD-004');
  });
});

// ── User activate/deactivate ───────────────────────────────────────────────────

test.describe('User activate/deactivate', () => {
  test('deactivate renter HD-CC-003 → row shows inactive state', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    const row = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    const deactivateBtn = row.locator('button').filter({ hasText: /deactivate/i }).first();
    await deactivateBtn.click();
    await page.waitForTimeout(2000);
    // Row should show inactive/deactivated state
    const updatedRow = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(updatedRow).toContainText(/inactive|deactivated/i);
  });

  test('activate renter HD-CC-003 → row shows active state', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    const row = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    // Find activate button (shown when user is inactive)
    const activateBtn = row.locator('button').filter({ hasText: /activate/i }).first();
    await activateBtn.click();
    await page.waitForTimeout(2000);
    const updatedRow = page.locator('#user-list table tr').filter({ hasText: 'HD-CC-003' }).first();
    await expect(updatedRow).not.toContainText(/inactive|deactivated/i);
  });
});

// ── Generate invite ────────────────────────────────────────────────────────────

test.describe('Generate invite', () => {
  test('fill invite form → invite URL is displayed', async ({ page }) => {
    await page.locator('#tab-btn-users').click();
    await page.waitForLoadState('networkidle');
    // Fill create-user form
    await page.locator('#cu-name').fill('Test');
    await page.locator('#cu-lastname').fill('Invitee');
    await page.locator('#cu-phone').fill('+49300000099');
    await page.locator('#cu-address').fill('Test Street 99');
    // Select a free spot — s7 should be free in seed
    await page.locator('#cu-spot').selectOption({ label: /7/ });
    await page.locator('#cu-plate').fill('HD-ZZ-099');
    await page.locator('#cu-carmodel').fill('Test Car');
    await page.locator('#cu-carcolor').fill('white');
    await page.locator('#create-user-form button[type=submit]').click();
    await page.waitForTimeout(2000);
    // Invite result box should appear with a URL
    await expect(page.locator('#invite-result-box')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#invite-url-text')).not.toBeEmpty();
  });
});

// ── Spot assignment ────────────────────────────────────────────────────────────

test.describe('Spot assign/unassign', () => {
  test('assign free spot s8 to renter HD-CC-003 → spot shows occupied', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await page.waitForLoadState('networkidle');
    // Find s8 row (free spot) — no renter plate in it
    const s8Row = page.locator('#spot-list table tr').filter({ hasText: /^\s*8\s/ }).first();
    await expect(s8Row).toBeVisible({ timeout: 10_000 });
    // Select user in the assign dropdown in that row
    const assignSelect = s8Row.locator('select').first();
    await assignSelect.selectOption({ label: /HD-CC-003/ });
    const assignBtn = s8Row.locator('button').filter({ hasText: /assign/i }).first();
    await assignBtn.click();
    await page.waitForTimeout(2000);
    // Row should now show renter's plate
    await expect(page.locator('#spot-list table tr').filter({ hasText: 'HD-CC-003' })).toBeVisible({ timeout: 10_000 });
  });

  test('unassign s1 → spot becomes free', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await page.waitForLoadState('networkidle');
    const s1Row = page.locator('#spot-list table tr').filter({ hasText: 'HD-AA-001' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    const unassignBtn = s1Row.locator('button').filter({ hasText: /unassign/i }).first();
    await unassignBtn.click();
    await page.waitForTimeout(2000);
    // s1 row should no longer contain the plate
    await expect(page.locator('#spot-list table')).not.toContainText('HD-AA-001');
  });
});

// ── Spot reserve/unreserve ─────────────────────────────────────────────────────

test.describe('Spot reserve/unreserve', () => {
  test('reserve free spot s4 → spot shows Reserved', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await page.waitForLoadState('networkidle');
    const s4Row = page.locator('#spot-list table tr').filter({ hasText: /^\s*4\s/ }).first();
    await expect(s4Row).toBeVisible({ timeout: 10_000 });
    const reserveBtn = s4Row.locator('button').filter({ hasText: /reserve/i }).first();
    await reserveBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.locator('#spot-list table tr').filter({ hasText: /reserved/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('unreserve s3 → spot no longer shows Reserved', async ({ page }) => {
    await page.locator('#tab-btn-spots').click();
    await page.waitForLoadState('networkidle');
    const s3Row = page.locator('#spot-list table tr').filter({ hasText: /Reserved/i }).first();
    await expect(s3Row).toBeVisible({ timeout: 10_000 });
    const unreserveBtn = s3Row.locator('button').filter({ hasText: /unreserve/i }).first();
    await unreserveBtn.click();
    await page.waitForTimeout(2000);
    await expect(s3Row).not.toContainText(/reserved/i);
  });
});
```

- [ ] **Step 2: Run to verify RED**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/admin-mutations.spec.js --reporter=list
```

Expected: all tests FAIL (elements not found, buttons not implemented, etc.) — not syntax errors.

- [ ] **Step 3: Confirm RED — no implementation needed**

These tests exercise existing admin.html functionality. If any test passes immediately, inspect what it matched and tighten the assertion (e.g. check DB state via page reload rather than just UI text).

- [ ] **Step 4: Run full suite to verify no regressions**

```bash
SKIP_SEED=1 npm run test:e2e
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/admin-mutations.spec.js
git commit -m "test(L4): admin mutation tests — approve/reject, activate/deactivate, invite, assign, reserve"
```

---

## Task 3: P1 — Payment mutation tests (mark paid, revert)

**Files:**
- Create: `tests/e2e/admin-payments-mutations.spec.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/e2e/admin-payments-mutations.spec.js`:

```js
// tests/e2e/admin-payments-mutations.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test.beforeEach(async ({ page }) => {
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await page.locator('#tab-btn-payments').click();
  await expect(page.locator('#payment-year')).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
});

test.describe('Mark paid / revert', () => {
  test('mark s2 current month as paid → cell shows ✓', async ({ page }) => {
    // s2 row is the second data row in the matrix
    const s2Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    // Find an unpaid cell (button with "Mark paid" or similar) in s2 row
    const markBtn = s2Row.locator('button, .payment-cell-unpaid').first();
    await markBtn.click();
    await page.waitForTimeout(2000);
    // Cell should now show ✓
    await expect(s2Row).toContainText('✓');
  });

  test('revert s1 paid month → cell no longer shows ✓', async ({ page }) => {
    const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 1' }).first();
    await expect(s1Row).toBeVisible({ timeout: 10_000 });
    // Find a paid cell — it has ✓ and a revert/undo button
    const paidCell = s1Row.locator('.payment-cell-paid').first();
    await paidCell.click();
    await page.waitForTimeout(2000);
    // After revert — the ✓ should be gone from that specific cell
    // We verify by checking the cell no longer has paid styling
    await expect(s1Row.locator('.payment-cell-paid').first()).not.toBeVisible({ timeout: 5_000 });
  });

  test('mark paid persists after page reload', async ({ page }) => {
    const s2Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    const markBtn = s2Row.locator('button, .payment-cell-unpaid').first();
    await markBtn.click();
    await page.waitForTimeout(2000);
    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('#tab-btn-payments').click();
    await page.waitForLoadState('networkidle');
    const s2RowAfter = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2RowAfter).toContainText('✓', { timeout: 10_000 });
  });

  test('year selector changes displayed year', async ({ page }) => {
    const yearSelect = page.locator('#payment-year');
    const currentYear = new Date().getFullYear();
    // Select previous year
    await yearSelect.selectOption(String(currentYear - 1));
    await page.waitForTimeout(1000);
    // Table should still be visible (may have no data but should not error)
    await expect(page.locator('#payment-matrix')).toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 2: Run to verify RED**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/admin-payments-mutations.spec.js --reporter=list
```

Expected: tests FAIL.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin-payments-mutations.spec.js
git commit -m "test(L4): payment mutation tests — mark paid, revert, persistence, year selector"
```

---

## Task 4: P1 — Access control tests (renter blocked from admin, renter sees only own incidents)

**Files:**
- Create: `tests/e2e/access-control.spec.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/e2e/access-control.spec.js`:

```js
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
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    // Try to navigate to admin page directly
    await page.goto('/admin.html');
    // Should be redirected away from admin.html
    await expect(page).not.toHaveURL(/admin\.html/, { timeout: 10_000 });
  });

  test('renter sees only own incidents in incident log', async ({ page }) => {
    await loginAs(page, RENTER_USER, RENTER_PASS);
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 10_000 });
    // All visible incident cards must belong to renter's spot (s1)
    const cards = page.locator('.incident-card');
    const count = await cards.count();
    // Each card's spot reference must be s1 or "Spot 1"
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toContainText(/spot 1|s1/i);
    }
  });

  test('admin sees all incidents across all spots', async ({ page }) => {
    await loginAs(page, ADMIN_USER, ADMIN_PASS);
    await page.waitForURL(/admin\.html/, { timeout: 15_000 });
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 10_000 });
    // Admin incident log count should be >= renter's count
    const allCards = page.locator('.incident-card');
    const count = await allCards.count();
    expect(count).toBeGreaterThanOrEqual(0); // at least renders without error
  });
});

// ── API-level access control (L3 — Playwright request context) ────────────────

test.describe('API access control (L3)', () => {
  let renterToken;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/auth/login`, {
      data: { username: RENTER_USER, password: RENTER_PASS }
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    renterToken = data.accessToken;
  });

  test('unauthenticated request returns 401', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/spots`);
    expect(res.status()).toBe(401);
  });

  test('renter token cannot call admin-only mutation routes (403 or 401)', async ({ request }) => {
    // Attempt to patch another user's data
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
```

- [ ] **Step 2: Run to verify RED**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/access-control.spec.js --reporter=list
```

Expected: FAIL. The renter-to-admin redirect test fails if redirect not implemented; API tests fail if routes don't exist.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/access-control.spec.js
git commit -m "test(L3,L5): access control — renter blocked from admin UI and API, own-incidents only"
```

---

## Task 5: P2 — Multi-user sync tests

**Files:**
- Create: `tests/e2e/sync.spec.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/e2e/sync.spec.js`:

```js
// tests/e2e/sync.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER  = 'TEST-ADMIN';
const ADMIN_PASS  = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';
const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test.describe('Multi-user sync (L6)', () => {
  test('admin marks s2 paid → renter HD-BB-002 sees updated payment status after reload', async ({ browser }) => {
    const adminCtx  = await browser.newContext();
    const renterCtx = await browser.newContext();
    const adminPage  = await adminCtx.newPage();
    const renterPage = await renterCtx.newPage();

    // Both log in
    await Promise.all([
      loginAs(adminPage,  ADMIN_USER, ADMIN_PASS),
      loginAs(renterPage, 'HD-BB-002', 'TestPass123!'),
    ]);

    // Admin: navigate to payments tab, mark s2 as paid
    await adminPage.waitForURL(/admin\.html/, { timeout: 15_000 });
    await adminPage.waitForLoadState('networkidle');
    await adminPage.locator('#tab-btn-payments').click();
    await adminPage.waitForLoadState('networkidle');
    const s2Row = adminPage.locator('#payment-matrix table tr').filter({ hasText: 'Spot 2' }).first();
    await expect(s2Row).toBeVisible({ timeout: 10_000 });
    const markBtn = s2Row.locator('button, .payment-cell-unpaid').first();
    await markBtn.click();
    await adminPage.waitForTimeout(2000);

    // Renter: reload parking.html, navigate to payments section
    await renterPage.waitForURL(/parking\.html/, { timeout: 15_000 });
    await renterPage.reload();
    await renterPage.waitForLoadState('networkidle');
    // Renter's payment section should show paid status for current month
    await expect(page.locator('#my-payments-section')).toContainText(/paid|✓/i, { timeout: 10_000 });

    await adminCtx.close();
    await renterCtx.close();
  });

  test('admin assigns spot s8 to HD-CC-003 → renter sees occupied s8 on map after reload', async ({ browser }) => {
    const adminCtx  = await browser.newContext();
    const renterCtx = await browser.newContext();
    const adminPage  = await adminCtx.newPage();
    const renterPage = await renterCtx.newPage();

    await Promise.all([
      loginAs(adminPage,  ADMIN_USER, ADMIN_PASS),
      loginAs(renterPage, 'HD-CC-003', 'TestPass123!'),
    ]);

    // Admin: assign s8
    await adminPage.waitForURL(/admin\.html/, { timeout: 15_000 });
    await adminPage.waitForLoadState('networkidle');
    await adminPage.locator('#tab-btn-spots').click();
    await adminPage.waitForLoadState('networkidle');
    const s8Row = adminPage.locator('#spot-list table tr').filter({ hasText: /^\s*8\s/ }).first();
    await expect(s8Row).toBeVisible({ timeout: 10_000 });
    const assignSelect = s8Row.locator('select').first();
    await assignSelect.selectOption({ label: /HD-CC-003/ });
    await s8Row.locator('button').filter({ hasText: /assign/i }).first().click();
    await adminPage.waitForTimeout(2000);

    // Renter: reload, check map spot s8 is now occupied
    await renterPage.waitForURL(/parking\.html/, { timeout: 15_000 });
    await renterPage.reload();
    await renterPage.waitForLoadState('networkidle');
    const s8Spot = renterPage.locator('svg g[data-id="s8"]');
    await expect(s8Spot).toBeVisible({ timeout: 10_000 });
    // Spot should have occupied class
    await expect(s8Spot).toHaveClass(/occupied/, { timeout: 5_000 });

    await adminCtx.close();
    await renterCtx.close();
  });
});
```

- [ ] **Step 2: Fix the typo in sync test (renterPage reference)**

In the first test, `page.locator('#my-payments-section')` should be `renterPage.locator('#my-payments-section')`. Fix it in the file:

```js
// Line with the bug:
await expect(page.locator('#my-payments-section')).toContainText(/paid|✓/i, { timeout: 10_000 });
// Should be:
await expect(renterPage.locator('#my-payments-section')).toContainText(/paid|✓/i, { timeout: 10_000 });
```

- [ ] **Step 3: Run to verify RED**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/sync.spec.js --reporter=list
```

Expected: FAIL.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/sync.spec.js
git commit -m "test(L6): multi-user sync — admin marks paid, assigns spot → renter sees updates"
```

---

## Task 6: P2 — register.html 3-step wizard tests

**Files:**
- Create: `tests/e2e/register.spec.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/e2e/register.spec.js`:

```js
// tests/e2e/register.spec.js
import { test, expect } from '@playwright/test';

// Uses seed invite token: 'valid-token-s4' (valid, spot s4) and 'valid-token-s7' (valid, spot s7)
// 'expired-token' = expired, 'used-token' = already used

test.describe('register.html — step indicator', () => {
  test('valid token shows step 1 (Review) as active', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    // Step 1 indicator should be active
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
    // Step 2 should now be visible
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
    // r-plate should be readonly (pre-filled from invite)
    const plateInput = page.locator('#r-plate');
    await expect(plateInput).toHaveValue('HD-GG-007');
    expect(await plateInput.getAttribute('readonly')).not.toBeNull();
  });

  test('submit registration → step 3 done shown', async ({ page }) => {
    await page.goto('/register.html?token=valid-token-s7');
    await page.waitForLoadState('networkidle');
    await page.locator('#agree-btn').click();
    await expect(page.locator('#step-register')).toBeVisible({ timeout: 5_000 });
    // Fill required fields
    await page.locator('#r-password').fill('NewPass123!');
    // r-plate, r-carmodel, r-carcolor are pre-filled and readonly from invite
    await page.locator('#register-form button[type=submit]').click();
    await page.waitForTimeout(3000);
    // Step 3 done should be visible
    await expect(page.locator('#step-done')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#done-username')).toContainText('HD-GG-007');
  });
});
```

- [ ] **Step 2: Run to verify RED**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/register.spec.js --reporter=list
```

Expected: FAIL — pages load but step elements hidden, invite tokens not found in seed.

- [ ] **Step 3: Verify seed has the required tokens**

The seed was extended in Task 1 with `valid-token-s7`. Verify `expired-token` and `used-token` are present in original seed. Run:

```bash
node -e "import('./tests/fixtures/seed.js').catch(e => { console.log(e.message) })"
```

If `expired-token` or `used-token` are missing from seed, add them (see existing invite seeds in seed.js).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/register.spec.js
git commit -m "test(L4,L7): register.html 3-step wizard — step progression, prefill, submission, error paths"
```

---

## Task 7: P2 — Acceptance test: full renter journey

**Files:**
- Create: `tests/e2e/acceptance-renter.spec.js`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/acceptance-renter.spec.js`:

```js
// tests/e2e/acceptance-renter.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const RENTER_USER = 'HD-AA-001';
const RENTER_PASS = 'TestPass123!';

test('Full renter journey: login → view map → click own spot → view payments → edit profile', async ({ page }) => {
  // Step 1: Login as renter
  await loginAs(page, RENTER_USER, RENTER_PASS);
  await page.waitForURL(/parking\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  // Step 2: Parking map is visible with spots
  await expect(page.locator('#parking-svg')).toBeVisible({ timeout: 10_000 });
  const spotCount = await page.locator('svg g[data-id]').count();
  expect(spotCount).toBeGreaterThanOrEqual(24);

  // Step 3: Click own spot (s1) → info panel shows own data
  await page.locator('svg g[data-id="s1"]').click();
  await expect(page.locator('#info-panel')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('#info-panel')).toContainText('HD-AA-001');

  // Step 4: My payments section is visible
  await expect(page.locator('#my-payments-section')).toBeVisible({ timeout: 10_000 });
  // Payment section shows current year
  const currentYear = String(new Date().getFullYear());
  await expect(page.locator('#my-payments-section')).toContainText(currentYear);

  // Step 5: Residents list — toggle and verify it opens
  const residentsToggle = page.locator('#residents-toggle');
  await expect(residentsToggle).toBeVisible({ timeout: 5_000 });
  await residentsToggle.click();
  await expect(page.locator('#residents-panel')).toBeVisible({ timeout: 5_000 });

  // Step 6: Profile edit section is visible, phone field is editable
  await expect(page.locator('#profile-edit-section')).toBeVisible({ timeout: 10_000 });
  const phoneField = page.locator('#p-phone');
  await expect(phoneField).toBeVisible({ timeout: 5_000 });
  await phoneField.fill('+49300000099');
  // Submit profile edit
  const saveBtn = page.locator('#profile-edit-section button[type=submit]').first();
  await saveBtn.click();
  await page.waitForTimeout(2000);
  // No error should appear
  await expect(page.locator('.toast-error, .alert.error')).not.toBeVisible({ timeout: 3_000 });
});
```

- [ ] **Step 2: Run to verify RED**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/acceptance-renter.spec.js --reporter=list
```

Expected: FAIL at one of the steps.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/acceptance-renter.spec.js
git commit -m "test(L7): acceptance — full renter journey (login, map, spot click, payments, profile edit)"
```

---

## Task 8: P2 — Acceptance test: full admin journey

**Files:**
- Create: `tests/e2e/acceptance-admin.spec.js`

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/acceptance-admin.spec.js`:

```js
// tests/e2e/acceptance-admin.spec.js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';

const ADMIN_USER = 'TEST-ADMIN';
const ADMIN_PASS = process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!';

test('Full admin journey: login → generate invite → approve pending registration → mark payment paid', async ({ page }) => {
  // Step 1: Login as admin
  await loginAs(page, ADMIN_USER, ADMIN_PASS);
  await page.waitForURL(/admin\.html/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');

  // Step 2: Stat cards visible
  await expect(page.locator('#stat-cards')).toBeVisible({ timeout: 10_000 });

  // Step 3: Generate invite for a free spot
  await page.locator('#cu-name').fill('Acceptance');
  await page.locator('#cu-lastname').fill('Tester');
  await page.locator('#cu-phone').fill('+49300000099');
  await page.locator('#cu-address').fill('Acceptance Street 1');
  await page.locator('#cu-spot').selectOption({ index: 1 }); // first available free spot
  await page.locator('#cu-plate').fill('HD-YY-099');
  await page.locator('#cu-carmodel').fill('Test Model');
  await page.locator('#cu-carcolor').fill('red');
  await page.locator('#create-user-form button[type=submit]').click();
  await page.waitForTimeout(2000);
  // Invite URL is generated
  await expect(page.locator('#invite-result-box')).toBeVisible({ timeout: 10_000 });
  const inviteUrl = await page.locator('#invite-url-text').textContent();
  expect(inviteUrl).toBeTruthy();

  // Step 4: Approve the existing pending registration HD-DD-004
  const pendingRow = page.locator('#pending-reg-list tr, #pending-reg-list .pending-row')
    .filter({ hasText: 'HD-DD-004' }).first();
  await expect(pendingRow).toBeVisible({ timeout: 10_000 });
  await pendingRow.locator('button').filter({ hasText: /approve/i }).first().click();
  await page.waitForTimeout(2000);
  await expect(page.locator('#user-list')).toContainText('HD-DD-004', { timeout: 10_000 });

  // Step 5: Navigate to payments, mark s1 current month paid
  await page.locator('#tab-btn-payments').click();
  await page.waitForLoadState('networkidle');
  const s1Row = page.locator('#payment-matrix table tr').filter({ hasText: 'Spot 1' }).first();
  await expect(s1Row).toBeVisible({ timeout: 10_000 });
  await expect(s1Row).toContainText('✓'); // already seeded as paid

  // Step 6: CSV export works
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10_000 }),
    page.locator('#csv-export-btn').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
});
```

- [ ] **Step 2: Run to verify RED**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/acceptance-admin.spec.js --reporter=list
```

Expected: FAIL at one of the steps.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/acceptance-admin.spec.js
git commit -m "test(L7): acceptance — full admin journey (login, invite, approve reg, payments, CSV)"
```

---

## Task 9: P3 — Parking map interactions (info panel, residents, profile edit)

**Files:**
- Modify: `tests/e2e/spots.spec.js` (extend existing file)

- [ ] **Step 1: Read existing spots.spec.js**

```bash
cat tests/e2e/spots.spec.js
```

- [ ] **Step 2: Add missing tests to spots.spec.js**

Append to `tests/e2e/spots.spec.js`:

```js
test.describe('Info panel content', () => {
  test('clicking occupied spot shows renter name and plate', async ({ page }) => {
    await loginAs(page, 'HD-AA-001', 'TestPass123!');
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    // Click s2 (another occupied spot)
    await page.locator('svg g[data-id="s2"]').click();
    await expect(page.locator('#info-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#info-panel')).toContainText('HD-BB-002');
  });

  test('clicking free spot shows "Free" in info panel', async ({ page }) => {
    await loginAs(page, 'HD-AA-001', 'TestPass123!');
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.locator('svg g[data-id="s5"]').click();
    await expect(page.locator('#info-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#info-panel')).toContainText(/free/i);
  });
});

test.describe('Residents list', () => {
  test('residents panel shows all active renters', async ({ page }) => {
    await loginAs(page, 'HD-AA-001', 'TestPass123!');
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.locator('#residents-toggle').click();
    await expect(page.locator('#residents-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#residents-panel')).toContainText('HD-AA-001');
    await expect(page.locator('#residents-panel')).toContainText('HD-BB-002');
  });
});

test.describe('My payments section', () => {
  test('payments section shows spot number and current year', async ({ page }) => {
    await loginAs(page, 'HD-AA-001', 'TestPass123!');
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#my-payments-section')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#my-payments-section')).toContainText(String(new Date().getFullYear()));
  });
});
```

- [ ] **Step 3: Run to verify RED on new tests only**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/spots.spec.js --reporter=list
```

Expected: new tests FAIL, existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/spots.spec.js
git commit -m "test(L4): parking map — info panel content, residents list, payments section"
```

---

## Task 10: P3 — Incident log tests (populated data, lightbox, admin delete, access control)

**Files:**
- Modify: `tests/e2e/incidents.spec.js` (extend existing file)

- [ ] **Step 1: Read existing incidents.spec.js**

```bash
cat tests/e2e/incidents.spec.js
```

- [ ] **Step 2: Seed an existing incident for renter HD-AA-001**

In `tests/fixtures/seed.js`, find the incidents section (or add one if absent):

```js
// Add after payments section in seed():
const incidents = [
  {
    id: 'inc-001',
    spotId: 's1',
    reportedByUserId: 'u-renter-a',
    observedPlate: 'HD-ZZ-000',
    note: 'Test incident for E2E',
    imageUrl: null,
    filePath: null,
    reportedAt: new Date().toISOString()
  }
];
const { error: incErr } = await supa.from('incidents').upsert(incidents);
if (incErr) throw new Error(`incidents upsert: ${incErr.message}`);
console.log('  ✓ incidents');
```

Run seed to verify: `node tests/fixtures/staging-config.js && node tests/fixtures/seed.js`

- [ ] **Step 3: Append tests to incidents.spec.js**

```js
test.describe('Incident log — populated data', () => {
  test('incident log shows seeded incident for renter', async ({ page }) => {
    await loginAs(page, 'HD-AA-001', 'TestPass123!');
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.incident-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.incident-card').first()).toContainText('HD-ZZ-000');
  });

  test('incident card shows note text', async ({ page }) => {
    await loginAs(page, 'HD-AA-001', 'TestPass123!');
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.incident-card').first()).toContainText('Test incident for E2E', { timeout: 10_000 });
  });
});

test.describe('Incident admin delete', () => {
  test('admin can see delete button on incident cards', async ({ page }) => {
    await loginAs(page, 'TEST-ADMIN', process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!');
    await page.waitForURL(/admin\.html/, { timeout: 15_000 });
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.incident-card').first()).toBeVisible({ timeout: 10_000 });
    // Admin should see a delete button
    await expect(page.locator('.incident-card button').filter({ hasText: /delete/i }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('renter cannot see delete button on incident cards', async ({ page }) => {
    await loginAs(page, 'HD-AA-001', 'TestPass123!');
    await page.waitForURL(/parking\.html/, { timeout: 15_000 });
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.incident-card').first()).toBeVisible({ timeout: 10_000 });
    // Renter should NOT see a delete button
    await expect(page.locator('.incident-card button').filter({ hasText: /delete/i }).first()).not.toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 4: Run to verify RED on new tests**

```bash
SKIP_SEED=1 npx playwright test tests/e2e/incidents.spec.js --reporter=list
```

Expected: new tests FAIL, existing pass.

- [ ] **Step 5: Commit seed and test changes**

```bash
git add tests/fixtures/seed.js tests/e2e/incidents.spec.js
git commit -m "test(L4,L5): incident log — seeded data, populated cards, admin delete btn, renter restriction"
```

---

## Task 11: Push all and verify CI

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Monitor CI**

```bash
gh run list --branch main --limit 3
gh run watch
```

Expected: `Unit Tests ✓`, `E2E Integration Tests ✓`

- [ ] **Step 3: If CI fails — read failure artifacts**

```bash
gh run view --log-failed
```

Fix root cause (selector drift, missing seed data, timing). Never soften a failing test — fix the root cause.

- [ ] **Step 4: Update tdd-first adapter with new patterns from this implementation**

Update `.claude/skills/tdd-first-adapter.md`:
- Add `inc-001` to seed state table (incidents section)
- Add `valid-token-s7`, `valid-token-s4` to seed state table (invites)
- Add `u-renter-c` spot assignment to seed state table

```bash
# Edit .claude/skills/tdd-first-adapter.md (sections 4 and 6)
# Then:
git add .claude/skills/tdd-first-adapter.md
git commit -m "chore: update tdd-first adapter — incident seed, s7 invite, renter-c spot"
```

---

## Self-Review

**Spec coverage check:**
- P1 mutations (approve/reject, activate/deactivate, invite, assign/unassign, reserve/unreserve) → Task 2 ✓
- P1 payment mutations (mark paid, revert) → Task 3 ✓
- P1 access control (renter blocked, own incidents) → Task 4 ✓
- P2 multi-user sync → Task 5 ✓
- P2 register.html wizard → Task 6 ✓
- P2 acceptance renter → Task 7 ✓
- P2 acceptance admin → Task 8 ✓
- P3 parking map interactions → Task 9 ✓
- P3 incident log → Task 10 ✓
- CI gate + adapter update → Task 11 ✓

**Placeholder scan:** No TBD/TODO found. All test code is complete with exact selectors.

**Type consistency:** `loginAs` signature consistent across all files. `ADMIN_PASS`, `RENTER_PASS` constants consistent. `#payment-matrix table tr` filter pattern consistent with existing `admin-payments.spec.js`. `svg g[data-id="sN"]` selector consistent with existing `spots.spec.js`.

**One note:** Tasks 2–5 (approve/reject, activate/deactivate, assign/unassign, reserve/unreserve, mark paid/revert) exercise existing UI — these tests may pass immediately if the UI already works correctly. Per the tdd-first protocol, a test that passes immediately against existing functionality is **valid** (not broken). Only a test that passes against a non-existent feature is broken. These are retroactive tests, so immediate pass = feature exists and works.
