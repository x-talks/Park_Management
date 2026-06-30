# Test Suite Design

**Goal:** Full automated test coverage (unit + E2E integration) for every feature, button click, and data mutation in the Park Management app, running on every push to main via GitHub Actions CI.

**Architecture:** Vitest for pure JS logic (no browser, no network, fast), Playwright for full browser integration tests against a dedicated staging environment. Unit tests gate E2E tests in CI — unit must pass first.

**Tech Stack:** Vitest, Playwright, Node.js, GitHub Actions, staging Supabase project, staging Cloudflare Worker, `npx serve` for local static file serving in CI.

---

## File Structure

```
tests/
  unit/
    payments.test.js       — getRentForMonth, pro-rating, commission amount
    spots.test.js          — sortSpots, spotStateClass, spotId mapping
    auth.test.js           — getSession, requireAuth logic
    i18n.test.js           — t(), getLang/setLang, applyPage
    invite.test.js         — getPaymentFraction, license plate validation
  e2e/
    auth.spec.js           — login, logout, session persistence, re-auth modal
    spots.spec.js          — map render, spot click, info panel, owned indicator
    admin-users.spec.js    — user list, activate/deactivate, role, termination, pending registrations, create user
    admin-spots.spec.js    — assign/unassign/reserve, rent save, owned flag
    admin-payments.spec.js — one row per spot, commission, monthly columns, mark paid, revert, CSV export
    incidents.spec.js      — form submit, photo upload, list, lightbox
    invite.spec.js         — valid/expired/used token, form validation, registration flow
  fixtures/
    seed.js                — creates known staging data before each E2E run
    teardown.js            — wipes all staging tables after each E2E run
    staging-config.js      — reads STAGING_* env vars, exports config object

playwright.config.js       — baseURL=http://localhost:3000, 1 worker (sequential), screenshots+traces on failure
vitest.config.js           — unit tests only, node environment, coverage
package.json               — root-level scripts: test:unit, test:e2e, test:all
.github/workflows/ci.yml   — unit-tests job → e2e-tests job, artifacts on failure
```

---

## Unit Test Coverage

### `tests/unit/payments.test.js`
Tests for `getRentForMonth` and payment calculation logic extracted from `js/admin.js` and `admin.html`.

- `getRentForMonth(spot, year, month)`:
  - returns `spot.monthlyRent` when no `rentHistory`
  - returns `80` default when neither `rentHistory` nor `monthlyRent` present
  - returns correct rent when history has one entry before the requested month
  - returns most recent applicable entry when history has multiple entries
  - ignores future history entries
- Pro-rating (first month calculation):
  - day ≤ 10 → fraction = 1 (full month)
  - day 11–20 → fraction = 0.5 (half month)
  - day > 20 → fraction = 1/3
- Commission amount = `getRentForMonth(spot, year, 1)` (first month rent)

### `tests/unit/spots.test.js`
Tests for spot utility functions from `js/parking.js` and `js/admin.js`.

- `spotId(label)`: '1'→'s1', 'A'→'sA', '22'→'s22'
- `spotStateClass(spotData, pendingSpotIds)`:
  - reserved spot → 'reserved'
  - spot in pendingSpotIds → 'pending'
  - spot with assignedUserId → 'occupied'
  - otherwise → 'free'
- `sortSpots(spots)`: sorts numerically (1–22) then alphabetically (A, B)

### `tests/unit/auth.test.js`
Tests for session logic from `js/auth.js`.

- `getSession()`: returns null when localStorage empty
- `getSession()`: returns parsed object when localStorage has valid JSON
- `requireAuth()`: calls `location.href = 'index.html'` when no session
- `requireAuth('admin')`: redirects when session role is 'renter'
- `requireAuth('admin')`: does not redirect when session role is 'admin'
- `requireAuth('admin')`: does not redirect when session role is 'master'

### `tests/unit/i18n.test.js`
Tests for translation functions from `js/i18n.js`.

- `t('key')`: returns translation string for known key
- `t('key')`: returns key itself when not found (no crash)
- `t('key', 'arg0', 'arg1')`: substitutes `{0}` and `{1}` correctly
- `getLang()`: returns 'en' by default
- `setLang('de')`: persists to localStorage, switches active translations
- `applyPage()`: replaces all `[data-i18n]` text content in DOM
- `applyPage()`: replaces all `[data-i18n-ph]` placeholder attributes
- `applyPage()`: replaces all `[data-i18n-title]` title attributes

### `tests/unit/invite.test.js`
Tests for invite utility functions from `js/invite.js`.

- `getPaymentFraction(registeredAt)`:
  - day 1 → 1 (full)
  - day 10 → 1 (full)
  - day 11 → 0.5 (half)
  - day 20 → 0.5 (half)
  - day 21 → 1/3
  - day 28 → 1/3
- License plate validation (German format `XX-XX-000`):
  - 'HD-AB-123' → valid
  - 'B-XY-1234' → valid
  - 'INVALID' → invalid
  - '' → invalid
  - 'HD-AB-12345' → invalid (too many digits)

---

## E2E Test Coverage

All E2E tests run against `http://localhost:3000` (static files served by `npx serve .` in CI). Staging Supabase + Worker URLs injected via `tests/fixtures/staging-config.js` which writes a `js/config.staging.js` before serve starts.

### Staging seed state (created by `seed.js` before every run)

| Entity | Details |
|--------|---------|
| master user | username: `TEST-MASTER`, password: from `STAGING_MASTER_PASSWORD` secret |
| admin user | username: `TEST-ADMIN`, password: from `STAGING_ADMIN_PASSWORD` secret |
| renter user A | username: `HD-AA-001`, active, assigned to spot s1, registeredAt: first of current month |
| renter user B | username: `HD-BB-002`, active, assigned to spot s2, terminationDate: last day of current month |
| renter user C | username: `HD-CC-003`, inactive (deactivated) |
| spots s1–s22, sA, sB | s1 assigned to A, s2 assigned to B, s3 reserved, rest free; sA owned=true |
| payments | commission paid for s1; rent paid for s1 current month; rent paid for s2 last month |
| invite token VALID | spotId: s4, expires 7 days from now, not used |
| invite token EXPIRED | spotId: s5, expired yesterday |
| pending registration | for spot s6, username HD-DD-004 |

### `tests/e2e/auth.spec.js`

- Login with correct admin credentials → redirects to `admin.html`
- Login with correct renter credentials → redirects to `parking.html`
- Login with wrong password → shows error message, stays on login page
- Login with unknown username → shows error message
- After login, close tab and reopen URL → session restored (still logged in)
- Logout button → redirects to `index.html`, session cleared
- After logout, navigate back to `parking.html` → redirected to `index.html`
- Re-auth modal: simulate expired access token (overwrite localStorage token with expired JWT) → next API call shows re-auth modal, not redirect
- Re-auth modal: enter wrong password → shows error, stays open
- Re-auth modal: enter correct password → modal closes, action completes

### `tests/e2e/spots.spec.js`

- Login as renter A → parking map loads with 24 spots visible
- All 24 spot labels visible on SVG map
- Spot s1 (assigned to renter A) shows license plate pill
- Spot s3 (reserved) shows reserved state class
- Spot sA (owned) shows dot indicator
- Click free spot → info panel expands with spot details
- Click same spot again → info panel collapses
- Click different spot → info panel switches to new spot
- Info panel shows correct spot label, state, renter name (if occupied)
- Renter A sees "My spot" indicator on s1

### `tests/e2e/admin-users.spec.js`

- Login as admin → Users tab visible and active by default
- User list renders with all users (master, admin, renter A, B, C)
- Deactivate renter A → row shows deactivated state, button changes to Activate
- Activate renter A → row shows active state again
- Cannot deactivate master user (button absent or disabled)
- Set termination date on renter B → chip appears in row with date
- Clear termination date → chip disappears
- Reset password for renter A → success (no error)
- Pending registrations badge shows count
- Pending registration for HD-DD-004 visible in list
- Approve pending registration → user appears in user list, pending list shrinks
- Reject pending registration → pending list shrinks, user not created
- Create user form: submit with all fields → invite link generated and displayed
- Create user form: submit missing required field → validation error shown

### `tests/e2e/admin-spots.spec.js`

- Login as admin → Spots tab renders table with all 24 spots
- s1 shows assigned renter name
- s3 shows reserved badge
- Assign spot s7 to renter C → spot row shows renter name, unassign button appears
- Unassign spot s7 → spot row shows free, assign controls reappear
- Mark spot s8 reserved → reserved badge appears
- Unmark spot s8 reserved → badge disappears
- Change rent on s1: type new value, blur → row updates with new amount, no error
- Change rent on s1: type same value, blur → no API call made
- Change rent on s1: type negative value, blur → alert shown, value reset
- Change rent on s1: type value, press Enter → saves (same as blur)
- Toggle owned on sA → owned indicator changes

### `tests/e2e/admin-payments.spec.js`

- Login as admin → Payments tab renders
- Table has exactly one row per assigned spot (s1, s2)
- s1 row shows commission column as paid (✓ with date and revert button)
- s2 row shows commission column as unpaid (amount + mark-paid button)
- Month columns only shown up to current month (no future months)
- s2 shows `—` for months before renter B's registration
- Current month for s1 shows paid (✓)
- Last month for s2 shows paid (✓)
- Click revert on s1 commission → confirm dialog → commission shows unpaid
- Click mark-paid on s1 commission → commission shows paid with today's date
- Click mark-paid on unpaid month → shows paid
- Click revert on paid month → shows unpaid
- CSV export button → file downloaded, contains correct headers and rows
- Year selector: change to previous year → table updates for that year

### `tests/e2e/incidents.spec.js`

- Login as renter A → Incidents page accessible via nav
- Submit incident form with note only → incident appears in list
- Submit incident form with note + photo → incident appears with thumbnail
- Incident list shows reporter name, spot, date, note
- Click photo thumbnail → lightbox opens full-size image
- Click outside lightbox → lightbox closes

### `tests/e2e/invite.spec.js`

- Navigate to `invite.html?token=VALID` → registration form loads with pre-filled spot info
- Navigate to `invite.html?token=EXPIRED` → error message shown, form not shown
- Navigate to `invite.html?token=USED` → error message shown (after seeding a used token)
- Navigate to `invite.html?token=NONEXISTENT` → error message shown
- Submit form with invalid license plate → validation error shown
- Submit form missing required field → validation error shown
- Submit valid form → success message shown; pending registration visible in admin panel

---

## Staging Environment

### Supabase staging project
Separate free-tier Supabase project with identical schema to production. `seed.js` uses the service key to insert known rows directly. `teardown.js` deletes all rows from all tables using the service key.

### Cloudflare Worker staging environment
`wrangler.jsonc` gets a `[env.staging]` block pointing to staging Supabase URL + service key secret. Deploy command: `wrangler deploy --env staging`.

### Static file serving in CI
`npx serve . --listen 3000` serves the frontend. Before starting, `tests/fixtures/staging-config.js` overwrites `js/config.js` with staging URLs so the browser-loaded JS talks to staging, not production.

---

## CI Pipeline (`.github/workflows/ci.yml`)

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup node 20
      - npm ci
      - npm run test:unit -- --coverage
      - upload coverage artifact

  e2e-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    env:
      STAGING_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
      STAGING_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
      STAGING_SUPABASE_SERVICE_KEY: ${{ secrets.STAGING_SUPABASE_SERVICE_KEY }}
      STAGING_WORKER_URL: ${{ secrets.STAGING_WORKER_URL }}
      STAGING_ADMIN_PASSWORD: ${{ secrets.STAGING_ADMIN_PASSWORD }}
      STAGING_MASTER_PASSWORD: ${{ secrets.STAGING_MASTER_PASSWORD }}
    steps:
      - checkout
      - setup node 20
      - npm ci
      - npx playwright install --with-deps chromium
      - node tests/fixtures/staging-config.js   # overwrites js/config.js with staging URLs
      - node tests/fixtures/seed.js             # seeds staging DB
      - npx serve . --listen 3000 &             # serve static files
      - npm run test:e2e
      - node tests/fixtures/teardown.js         # always runs (post step)
      - upload playwright-report artifact on failure
      - upload screenshots artifact on failure
```

---

## GitHub Secrets Required

| Secret | Purpose |
|--------|---------|
| `STAGING_SUPABASE_URL` | Staging Supabase project URL |
| `STAGING_SUPABASE_ANON_KEY` | Staging anon key (used by frontend) |
| `STAGING_SUPABASE_SERVICE_KEY` | Staging service key (used by seed/teardown) |
| `STAGING_WORKER_URL` | Staging Cloudflare Worker URL |
| `STAGING_ADMIN_PASSWORD` | Password for TEST-ADMIN user |
| `STAGING_MASTER_PASSWORD` | Password for TEST-MASTER user |
