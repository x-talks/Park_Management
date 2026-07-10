---
name: tdd-first-adapter
description: >
  Project-local adapter for the tdd-first skill. Auto-generated from the
  actual Park Management stack. Tells Claude exactly which tools, patterns,
  selectors, and seed conventions to use when running the TDD protocol in
  this project. Do not edit manually — Claude rewrites this file when the
  stack changes.
type: reference
generated: 2026-07-10
stack: Vanilla JS + Supabase + Cloudflare Workers
---

# TDD-First Adapter — Park Management

> Auto-generated 2026-07-10. Claude updates this file after features that
> introduce new patterns. Never edit manually.

---

## 1. Stack Inventory

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | ^2.1.0 | Unit + component tests (jsdom environment) |
| @vitest/coverage-v8 | ^2.1.0 | Coverage reporting |
| jsdom | ^25.0.0 | DOM simulation for unit tests |
| @playwright/test | ^1.61.1 | E2E, integration (request context), access control, sync, acceptance |
| serve | ^14.2.6 | Static file server for E2E (port 3000) |
| @supabase/supabase-js | ^2.110.0 | Seed/teardown scripts |

**Coming next (React/TS/Vite/Tailwind):** When these are added, update L2 to use
`@testing-library/react` + `@testing-library/user-event`. Update this section
and the Component Test Patterns section at that time.

---

## 2. Layer-to-Tool Mapping

| Layer | Tool | Runner command |
|-------|------|---------------|
| L1 Unit | Vitest + jsdom | `npm run test:unit` |
| L2 Component | Vitest + jsdom (vanilla) | `npm run test:unit` |
| L3 Integration | Playwright `request` context | `npm run test:e2e` |
| L4 System/E2E | Playwright browser (Chromium) | `npm run test:e2e` |
| L5 Access Control | Playwright browser, multi-role pages | `npm run test:e2e` |
| L6 Multi-User Sync | Playwright `browser.newContext()` × 2 | `npm run test:e2e` |
| L7 Acceptance | Playwright browser (full journey) | `npm run test:e2e` |

Run everything: `npm run test:all`

---

## 3. Test File Conventions

### Directory structure
```
tests/
  unit/           ← L1 + L2: Vitest tests
    auth.test.js
    payments.test.js
    spots.test.js
    i18n.test.js
    invite.test.js
    [feature].test.js   ← new unit tests go here
  e2e/            ← L3–L7: Playwright tests
    helpers.js
    auth.spec.js
    spots.spec.js
    admin-users.spec.js
    admin-spots.spec.js
    admin-payments.spec.js
    incidents.spec.js
    invite.spec.js
    [feature].spec.js   ← new E2E tests go here
  fixtures/
    seed.js             ← add new entities here for new features
    teardown.js
    staging-config.js
    playwright-global-setup.js
    playwright-global-teardown.js
```

### File naming
- Unit tests: `tests/unit/[feature-area].test.js`
- E2E tests: `tests/e2e/[feature-area].spec.js`
  - Admin features: `admin-[area].spec.js` (e.g. `admin-spots.spec.js`)
  - Renter features: `[area].spec.js` (e.g. `spots.spec.js`, `incidents.spec.js`)
  - Auth/invite flows: `auth.spec.js`, `invite.spec.js`

### Import patterns

**Unit tests (Vitest):**
```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
// globals: true in vitest.config.js — describe/it/expect available without import
// but explicit imports are preferred for clarity
```

**E2E tests (Playwright):**
```js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';
```

### Config files
- `vitest.config.js` — includes `tests/unit/**/*.{test,spec}.js`, jsdom env, globals
- `playwright.config.js` — testDir `./tests/e2e`, 1 worker, Chromium only, baseURL `http://localhost:3000`

---

## 4. Seed & Fixture Patterns

### Current seed state (as of 2026-07-10)

**Auth users + app users:**
| Username | Role | Password | App ID | Notes |
|----------|------|----------|--------|-------|
| TEST-MASTER | master | `$STAGING_MASTER_PASSWORD` | u-master | No action buttons in UI |
| TEST-ADMIN | admin | `$STAGING_ADMIN_PASSWORD` | u-admin | Full admin access |
| HD-AA-001 | renter | TestPass123! | u-renter-a | Assigned s1, payment this month |
| HD-BB-002 | renter | TestPass123! | u-renter-b | Assigned s2, has termination date |
| HD-CC-003 | renter | TestPass123! | u-renter-c | Assigned s6, inactive (deactivated) |

**Spots:**
| ID | Label | State | Notes |
|----|-------|-------|-------|
| s1 | 1 | occupied | assignedUserId: u-renter-a |
| s2 | 2 | occupied | assignedUserId: u-renter-b |
| s3 | 3 | free | reserved: true |
| s6 | 6 | occupied | assignedUserId: u-renter-c |
| sA | A | free | owned: true |
| sB | B | free | |
| s4–s22 (excl. s6) | 4–22 | free | |

**Payments:** 3 records — s1 commission (Jan this year), s1 current month, s2 prev month

**Invites:**
| ID | Token | SpotId | State | Notes |
|----|-------|--------|-------|-------|
| inv-valid | VALID-TOKEN-FOR-E2E | s4 | valid | Dave Invited |
| inv-expired | EXPIRED-TOKEN-FOR-E2E | s5 | expired | Eve Expired |
| inv-used | USED-TOKEN-FOR-E2E | s7 | used (u-renter-a) | Fred Used |
| inv-valid-s7 | valid-token-s7 | s7 | valid | David Prospect, plate HD-GG-007, Audi A4 silver |
| inv-expired-lc | expired-token | s9 | expired | for register.spec.js |
| inv-used-lc | used-token | s10 | used (u-renter-a) | for register.spec.js |

**Pending registrations:** 1 — plate HD-DD-004, spotId: s6, token: VALID-TOKEN-FOR-E2E

**Incidents:** 1 — inc-001, spotId: s1, reportedByUserId: u-renter-a, observedPlate: HD-ZZ-000, note: 'Test incident for E2E'

### Adding entities for a new feature

When a new feature needs new test data:

1. Open `tests/fixtures/seed.js`
2. Add new entities in the appropriate section (users, spots, payments, invites, etc.)
3. Use deterministic IDs (e.g. `u-renter-d`, `s6` for spot 6)
4. Document the new seed state in this adapter's table above
5. Run `node tests/fixtures/seed.js` locally to verify
6. Commit seed.js change together with the feature tests

### Seed env vars required
```
STAGING_SUPABASE_URL
STAGING_SUPABASE_SERVICE_KEY
STAGING_ADMIN_PASSWORD
STAGING_MASTER_PASSWORD
```

---

## 5. Auth Helper Patterns

### Browser tests (L4, L5, L6, L7)

```js
import { loginAs } from './helpers.js';

// Log in as admin
await loginAs(page, 'TEST-ADMIN', process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!');
await page.waitForURL(/admin\.html/, { timeout: 15_000 });

// Log in as renter
await loginAs(page, 'HD-AA-001', 'TestPass123!');
await page.waitForURL(/parking\.html/, { timeout: 15_000 });

// Log in as master
await loginAs(page, 'TEST-MASTER', process.env.STAGING_MASTER_PASSWORD || 'TestMaster123!');
await page.waitForURL(/admin\.html/, { timeout: 15_000 });
```

### API/integration tests (L3) — obtain token via Worker login

```js
import { test, expect, request as playwrightRequest } from '@playwright/test';

test('API-level access control', async ({ request }) => {
  // Get renter token
  const loginRes = await request.post(`${process.env.STAGING_WORKER_URL}/auth/login`, {
    data: { username: 'HD-AA-001', password: 'TestPass123!' }
  });
  const { accessToken: renterToken } = await loginRes.json();

  // Use it in subsequent requests
  const res = await request.patch(`${process.env.STAGING_WORKER_URL}/some-admin-route`, {
    headers: { Authorization: `Bearer ${renterToken}` },
    data: { field: 'value' }
  });
  expect(res.status()).toBe(403);
});
```

### Multi-role pattern (L5)

```js
test('admin can X, renter cannot', async ({ browser }) => {
  const adminCtx  = await browser.newContext();
  const renterCtx = await browser.newContext();
  const adminPage  = await adminCtx.newPage();
  const renterPage = await renterCtx.newPage();

  await loginAs(adminPage,  'TEST-ADMIN', process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!');
  await loginAs(renterPage, 'HD-AA-001', 'TestPass123!');

  // admin succeeds
  // renter is blocked

  await adminCtx.close();
  await renterCtx.close();
});
```

### Multi-user sync pattern (L6)

```js
test('admin action reflects for renter', async ({ browser }) => {
  const adminCtx  = await browser.newContext();
  const renterCtx = await browser.newContext();
  const adminPage  = await adminCtx.newPage();
  const renterPage = await renterCtx.newPage();

  await loginAs(adminPage,  'TEST-ADMIN', process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!');
  await loginAs(renterPage, 'HD-AA-001', 'TestPass123!');

  // Admin performs mutation
  // ...

  // Renter reloads and sees updated state
  await renterPage.reload();
  await renterPage.waitForLoadState('networkidle');
  // assert updated state visible to renter

  await adminCtx.close();
  await renterCtx.close();
});
```

---

## 6. Selector Strategy

**Priority order (highest to lowest):**
1. ARIA roles: `page.getByRole('button', { name: 'Submit' })`
2. Explicit IDs: `page.locator('#tab-btn-spots')`
3. Semantic text: `page.locator('button').filter({ hasText: /mark paid/i })`
4. Data attributes: `page.locator('[data-id="s1"]')` (SVG spots)
5. Class names: only for state indicators (`.termination-chip`, `.reserved`)

**Known element IDs (keep updated):**
```
Login:        #username, #password, button[type="submit"], #error
Admin tabs:   #tab-btn-users, #tab-btn-spots, #tab-btn-payments
Admin tables: #user-list table, #spot-list table, #payment-matrix table
Payments:     #payment-year, #csv-export-btn
Incidents:    #incident-form, #incident-log
SVG map:      svg g[data-id="sN"] (spot elements)
Re-auth:      #reauth-overlay, #reauth-password, #reauth-submit
```

**CRITICAL anti-patterns — never use these:**
- `table tbody tr` — JS-rendered tables have no `<tbody>` element; use `table tr` directly
- `filter({ hasText: /\bsN\b/ })` to find spot rows — spot cells show label "1" not "s1"; filter by unique renter data (plate number) instead
- Hardcoded pixel coordinates for SVG clicks — use `data-id` attribute

**Timing conventions:**
- Always `await page.waitForLoadState('networkidle')` after tab switches
- After mutations: `await page.waitForTimeout(1500)` for optimistic UI updates
- Prefer `await expect(locator).toBeVisible({ timeout: 10_000 })` over fixed waits

---

## 7. Component Test Patterns (Current: Vanilla JS + jsdom)

Unit tests for DOM-touching logic inline functions from source files and test them
in jsdom. Pattern from `tests/unit/auth.test.js`:

```js
// tests/unit/[feature].test.js
import { describe, it, expect, beforeEach } from 'vitest';

// Inline the function under test (copy from source file)
function myFunction(input) { /* copied from js/feature.js */ }

describe('myFunction', () => {
  it('returns expected output for valid input', () => {
    expect(myFunction('valid')).toBe('expected');
  });

  it('handles edge case', () => {
    expect(myFunction('')).toBeNull();
  });
});
```

**When React/TS/Vite/Tailwind is added:**
Replace inline-copy pattern with proper imports + React Testing Library.
Update this section at that time. The adapter will be regenerated.

---

## 8. Integration Test Patterns (L3 — Playwright request context)

Used when the feature touches a Worker route, RLS policy, schema change, or token flow.
No browser — pure HTTP via Playwright's `request` fixture.

```js
// tests/e2e/[feature]-integration.spec.js
import { test, expect } from '@playwright/test';

const WORKER_URL = process.env.STAGING_WORKER_URL;

test.describe('[Feature] — API integration', () => {
  let adminToken, renterToken;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${WORKER_URL}/auth/login`, {
      data: { username: 'TEST-ADMIN', password: process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!' }
    });
    adminToken = (await adminLogin.json()).accessToken;

    const renterLogin = await request.post(`${WORKER_URL}/auth/login`, {
      data: { username: 'HD-AA-001', password: 'TestPass123!' }
    });
    renterToken = (await renterLogin.json()).accessToken;
  });

  test('unauthenticated request is rejected (401)', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/some-protected-route`);
    expect(res.status()).toBe(401);
  });

  test('admin can access protected route (200)', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/some-protected-route`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status()).toBe(200);
  });

  test('renter is blocked from admin route (403)', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/admin-only-route`, {
      headers: { Authorization: `Bearer ${renterToken}` }
    });
    expect(res.status()).toBe(403);
  });
});
```

---

## 9. Multi-User Sync Patterns (L6)

```js
test('admin marks s1 paid → renter HD-AA-001 sees updated status', async ({ browser }) => {
  const adminCtx  = await browser.newContext();
  const renterCtx = await browser.newContext();
  const adminPage  = await adminCtx.newPage();
  const renterPage = await renterCtx.newPage();

  // Both log in simultaneously
  await Promise.all([
    loginAs(adminPage, 'TEST-ADMIN', process.env.STAGING_ADMIN_PASSWORD || 'TestAdmin123!'),
    loginAs(renterPage, 'HD-AA-001', 'TestPass123!'),
  ]);

  // Admin performs mutation
  await adminPage.waitForURL(/admin\.html/);
  await adminPage.waitForLoadState('networkidle');
  // ... admin action ...

  // Renter reloads and sees the change
  await renterPage.reload();
  await renterPage.waitForLoadState('networkidle');
  // ... assert renter sees updated state ...

  await adminCtx.close();
  await renterCtx.close();
});
```

**Timing:** Prefer `page.reload()` + `waitForLoadState('networkidle')` over polling.
If the app has real-time subscriptions (Supabase Realtime), assert without reload instead.

---

## 10. CI Configuration

### Job structure
```
unit-tests         → runs first, fast feedback
  └── e2e-tests    → depends on unit-tests, runs against staging
```

### Required GitHub secrets
| Secret | Purpose |
|--------|---------|
| `STAGING_SUPABASE_URL` | Staging Supabase project URL |
| `STAGING_SUPABASE_ANON_KEY` | Public anon key for staging |
| `STAGING_SUPABASE_SERVICE_KEY` | Service role key for seeding |
| `STAGING_WORKER_URL` | Cloudflare Worker URL for staging |
| `STAGING_ADMIN_PASSWORD` | TEST-ADMIN password |
| `STAGING_MASTER_PASSWORD` | TEST-MASTER password |
| `SUPABASE_ACCESS_TOKEN` | Personal access token for schema application via Management API |

### E2E pre-test steps (must run in this order)
1. Apply `db/schema.sql` to staging via Supabase Management API
2. `node tests/fixtures/staging-config.js` — writes `js/config.js` with staging URLs
3. `node tests/fixtures/seed.js` — seeds DB with known state
4. `npm run test:e2e` with `SKIP_SEED=1`

### Running locally
```bash
# Full local run (seeds automatically via global setup)
STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_KEY=... \
STAGING_ADMIN_PASSWORD=... STAGING_MASTER_PASSWORD=... \
STAGING_WORKER_URL=... node tests/fixtures/staging-config.js && \
npm run test:all

# Skip seeding (when staging already has correct data)
SKIP_SEED=1 npm run test:e2e
```

### Artifacts on failure
- `playwright-report/` — HTML report with traces
- `test-results/` — screenshots and videos
- `coverage/` — unit test coverage (always)
