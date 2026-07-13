# E2E Reliability Phase 1 — Resilience, Determinism, Observability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the root causes of E2E flakiness — the no-timeout `fetch` login hang, the broken `networkidle` waits, and undiagnosable failures — without changing test data or CI parallelism yet.

**Architecture:** Add a `fetchWithTimeout` (AbortController + one retry) inside `js/api.js` so browser requests fail fast and retry instead of hanging 45s. Enable Playwright CI retries. Replace `waitForLoadState('networkidle')` with explicit state waits. Add an auto-use Playwright fixture that captures console + failed-request logs and attaches them to the report on failure. Make the CI worker warm-up step fail fast.

**Tech Stack:** Vanilla JS (no build), Playwright, GitHub Actions, Node fixtures.

**Scope note:** This is Phase 1 of 3. Phase 2 = isolation (ID namespacing) + CI matrix sharding. Phase 3 = concurrency/real-time suite. This plan touches NO test data IDs and does NOT shard CI — it must remain green on the existing single shared-DB serial setup.

---

## File Map

| File | What changes |
|------|-------------|
| `js/api.js` | Add `fetchWithTimeout(url, options, {timeoutMs, retries})`; route `workerRequest`'s `_doRequest` and `_tryRefresh`'s fetch through it |
| `playwright.config.js` | `retries: process.env.CI ? 2 : 0` |
| `tests/e2e/helpers.js` | Add `waitForAppReady(page, role)`; lower `loginAs` timeout to 15s |
| `tests/e2e/fixtures.js` | NEW — observability fixture re-exporting `test`/`expect` |
| `tests/e2e/spots.spec.js` | Remove `networkidle`; import from `./fixtures.js`; use `waitForAppReady` |
| `tests/e2e/access-control.spec.js` | Remove two `networkidle` calls; import from `./fixtures.js` |
| `.github/workflows/ci.yml` | Make "Test worker login" step fail fast (assert accessToken, retry 3×) |

---

## Task 1: Add `fetchWithTimeout` helper to `js/api.js`

**Files:**
- Modify: `js/api.js` (add helper near top, after the file header comment block, before `_table`)

- [ ] **Step 1: Add the helper function**

Insert after the header comment block (before `function _table(path)` at line 15) in `js/api.js`:

```js
// ── Resilient fetch ─────────────────────────────────────────────────────────
// Wraps fetch with an AbortController timeout and one retry on transport
// failure/timeout. Does NOT retry on HTTP error responses (4xx/5xx are returned
// to the caller as-is). Fixes indefinite hangs when the Worker is cold.
async function fetchWithTimeout(url, options = {}, { timeoutMs = 10_000, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
    }
  }
  throw new Error('Network request failed or timed out: ' + (lastErr && lastErr.message ? lastErr.message : 'unknown'));
}
```

- [ ] **Step 2: Route `workerRequest`'s internal request through it**

In `js/api.js`, find `_doRequest` inside `workerRequest` (around line 209):

```js
  const _doRequest = () => fetch(CONFIG.workerUrl + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + (_accessToken() || ''),
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
```

Replace with:

```js
  const _doRequest = () => fetchWithTimeout(CONFIG.workerUrl + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + (_accessToken() || ''),
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
```

- [ ] **Step 3: Route `_tryRefresh`'s fetch through it**

In `js/api.js`, find the `fetch` call inside `_tryRefresh` (around line 86):

```js
    const res = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
```

Replace `fetch(` with `fetchWithTimeout(` (leave the arguments identical):

```js
    const res = await fetchWithTimeout(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
```

- [ ] **Step 4: Run unit tests to confirm nothing broke**

Run: `cd /Users/D069379/My_X/Park_Management && npm run test:unit`
Expected: all tests pass (78/78 as of last run). `fetchWithTimeout` is additive; existing behavior unchanged for successful requests.

- [ ] **Step 5: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add js/api.js
git commit -m "feat: fetchWithTimeout (AbortController 10s + 1 retry) for workerRequest and token refresh"
```

---

## Task 2: Enable Playwright retries in CI

**Files:**
- Modify: `playwright.config.js:8`

- [ ] **Step 1: Change the `retries` line**

In `playwright.config.js`, find:

```js
  retries: 0,
```

Replace with:

```js
  retries: process.env.CI ? 2 : 0,
```

- [ ] **Step 2: Verify config parses**

Run: `cd /Users/D069379/My_X/Park_Management && npx playwright test --list 2>&1 | head -5`
Expected: prints a list of tests without config errors. (Requires Playwright installed; if `--list` needs no browser, this just validates the config file.)

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add playwright.config.js
git commit -m "test: enable Playwright retries (2) in CI to absorb transient backend blips"
```

---

## Task 3: Add observability fixture

**Files:**
- Create: `tests/e2e/fixtures.js`

- [ ] **Step 1: Create the fixture file**

Create `tests/e2e/fixtures.js`:

```js
// tests/e2e/fixtures.js
// Extends Playwright's `test` with an auto-use fixture that captures browser
// console output, page errors, and failed network requests. On test failure,
// the captured logs are attached to the report so the underlying cause (e.g. a
// network error behind a "timeout") is visible instead of a bare timeout.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  _observability: [async ({ page }, use, testInfo) => {
    const logs = [];
    const failures = [];

    page.on('console', msg => {
      logs.push(`[console.${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      logs.push(`[pageerror] ${err.message}`);
    });
    page.on('requestfailed', req => {
      const f = req.failure();
      failures.push(`[requestfailed] ${req.method()} ${req.url()} — ${f ? f.errorText : 'unknown'}`);
    });
    page.on('response', async res => {
      if (res.status() >= 400) {
        let bodySnippet = '';
        try { bodySnippet = (await res.text()).slice(0, 500); } catch (_) {}
        failures.push(`[response ${res.status()}] ${res.request().method()} ${res.url()} — ${bodySnippet}`);
      }
    });

    await use();

    if (testInfo.status !== testInfo.expectedStatus) {
      if (logs.length) {
        await testInfo.attach('browser-console.txt', { body: logs.join('\n'), contentType: 'text/plain' });
      }
      if (failures.length) {
        await testInfo.attach('network-failures.txt', { body: failures.join('\n'), contentType: 'text/plain' });
      }
    }
  }, { auto: true }],
});

export { expect };
```

- [ ] **Step 2: Verify the fixture file has no syntax errors**

Run: `cd /Users/D069379/My_X/Park_Management && node --check tests/e2e/fixtures.js`
Expected: no output (exit 0) — `node --check` validates syntax. If it errors on `import`, that is acceptable only if the message is about ES modules; in that case verify by `npx playwright test --list` instead which loads it as a module.

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add tests/e2e/fixtures.js
git commit -m "test: add observability fixture capturing console + network failures on test failure"
```

---

## Task 4: Add `waitForAppReady` and lower `loginAs` timeout in helpers

**Files:**
- Modify: `tests/e2e/helpers.js`

- [ ] **Step 1: Rewrite `helpers.js` to add `waitForAppReady` and lower the timeout**

Replace the entire contents of `tests/e2e/helpers.js` with:

```js
// tests/e2e/helpers.js
export async function loginAs(page, username, password) {
  await page.goto('/');
  const usernameInput = page.locator('#username, input[name="username"], input[placeholder*="plate" i], input[placeholder*="user" i]').first();
  const passwordInput = page.locator('#password, input[type="password"]').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').click();
  // Login should complete quickly now that workerRequest has a 10s timeout + retry.
  await page.waitForURL(url => !url.toString().endsWith('index.html') && !url.toString().endsWith('/'), { timeout: 15_000 });
}

// Wait for a page's data-driven content to render, instead of the flaky
// waitForLoadState('networkidle') which never settles because parking.html and
// admin.html run a 30s setInterval poll.
export async function waitForAppReady(page, role = 'renter') {
  if (role === 'admin' || role === 'master') {
    // Admin page: renderUsers() builds a <table> of <tr> rows inside #user-list.
    // Wait for at least one row (header row counts, so this fires as soon as the
    // table is built — data rows follow synchronously in the same render).
    await page.locator('#user-list table tr').first().waitFor({ state: 'visible', timeout: 15_000 });
  } else {
    // Renter/parking page: wait for the SVG map to render at least one spot.
    await page.locator('svg g[data-id]').first().waitFor({ state: 'visible', timeout: 15_000 });
  }
}
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/D069379/My_X/Park_Management && node --check tests/e2e/helpers.js`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add tests/e2e/helpers.js
git commit -m "test: add waitForAppReady state-wait helper, lower loginAs timeout to 15s"
```

---

## Task 5: Remove `networkidle` from `spots.spec.js` and use fixtures

**Files:**
- Modify: `tests/e2e/spots.spec.js:2` (import), `tests/e2e/spots.spec.js:11` (networkidle)

- [ ] **Step 1: Switch the import to the observability fixture**

In `tests/e2e/spots.spec.js`, find:

```js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';
```

Replace with:

```js
import { test, expect } from './fixtures.js';
import { loginAs, waitForAppReady } from './helpers.js';
```

- [ ] **Step 2: Replace the `networkidle` wait in `beforeEach`**

In `tests/e2e/spots.spec.js`, find:

```js
  await page.waitForURL(/parking\.html/, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
```

Replace with:

```js
  await page.waitForURL(/parking\.html/, { timeout: 30_000 });
  await waitForAppReady(page, 'renter');
```

- [ ] **Step 3: Run unit tests (sanity — no JS logic changed, just confirm repo builds)**

Run: `cd /Users/D069379/My_X/Park_Management && npm run test:unit`
Expected: all pass (unit tests don't cover E2E, but confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add tests/e2e/spots.spec.js
git commit -m "test: spots.spec — use observability fixture + waitForAppReady, drop networkidle"
```

---

## Task 6: Remove `networkidle` from `access-control.spec.js` and use fixtures

**Files:**
- Modify: `tests/e2e/access-control.spec.js:2` (import), `:25` and `:38` (networkidle)

- [ ] **Step 1: Switch the import**

In `tests/e2e/access-control.spec.js`, find:

```js
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';
```

Replace with:

```js
import { test, expect } from './fixtures.js';
import { loginAs } from './helpers.js';
```

- [ ] **Step 2: Remove the first `networkidle` (renter incident log, line ~25)**

Find:

```js
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 10_000 });
```

Replace with (the `#incident-log` visibility wait already provides the needed synchronization):

```js
    await page.goto('/incident.html');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 15_000 });
```

- [ ] **Step 3: Remove the second `networkidle` (admin incident log, line ~38)**

Find:

```js
    await page.goto('/incident.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 10_000 });
```

Replace with:

```js
    await page.goto('/incident.html');
    await expect(page.locator('#incident-log')).toBeVisible({ timeout: 15_000 });
```

- [ ] **Step 4: Verify syntax**

Run: `cd /Users/D069379/My_X/Park_Management && node --check tests/e2e/access-control.spec.js`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add tests/e2e/access-control.spec.js
git commit -m "test: access-control.spec — use fixtures, replace networkidle with element waits"
```

---

## Task 7: Make the CI worker warm-up fail fast

**Files:**
- Modify: `.github/workflows/ci.yml` (the "Test worker login (shows exact response)" step, lines ~80-85)

- [ ] **Step 1: Replace the warm-up step with a fail-fast, retrying assertion**

In `.github/workflows/ci.yml`, find:

```yaml
      - name: Test worker login (shows exact response)
        run: |
          curl -sS -X POST "$STAGING_WORKER_URL/auth/login" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"TEST-ADMIN\",\"password\":\"$STAGING_ADMIN_PASSWORD\"}"
          echo ""
```

Replace with:

```yaml
      - name: Warm up worker and assert login works (fail fast)
        run: |
          for attempt in 1 2 3; do
            echo "Warm-up attempt $attempt..."
            RESPONSE=$(curl -sS -m 15 -X POST "$STAGING_WORKER_URL/auth/login" \
              -H "Content-Type: application/json" \
              -d "{\"username\":\"TEST-ADMIN\",\"password\":\"$STAGING_ADMIN_PASSWORD\"}" || true)
            echo "$RESPONSE" | grep -q '"accessToken"' && { echo "Worker login OK"; exit 0; }
            echo "No accessToken yet; response was: $RESPONSE"
            sleep 3
          done
          echo "Worker login failed after 3 attempts — failing fast instead of running the full suite."
          exit 1
```

- [ ] **Step 2: Validate the workflow YAML**

Run: `cd /Users/D069379/My_X/Park_Management && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`
Expected: prints `YAML OK`.

- [ ] **Step 3: Commit and push (triggers a real CI run to validate Phase 1)**

```bash
cd /Users/D069379/My_X/Park_Management
git add .github/workflows/ci.yml
git commit -m "ci: warm up worker with fail-fast login assertion (retry 3x, 15s each)"
git push origin main
```

- [ ] **Step 4: Watch the CI run and confirm green**

Run: `cd /Users/D069379/My_X/Park_Management && gh run list --workflow=ci.yml --limit 1 --json databaseId --jq '.[0].databaseId'` to get the run id, then `gh run view <id> --log-failed` after it completes.
Expected: E2E job passes (or fails only on genuinely pre-existing data issues, not login hangs / networkidle timeouts). Login-related tests should complete in seconds, not 45s.

---

## Self-Review Checklist

**Spec coverage (Phase 1 items only):**
- Resilience — `fetchWithTimeout` + `workerRequest`/`_tryRefresh` routing (Task 1) ✅
- Playwright CI retries (Task 2) ✅
- Observability fixture (Task 3) ✅
- Determinism — `waitForAppReady` (Task 4) + `networkidle` removal (Tasks 5, 6) ✅
- Fail-fast warm-up (Task 7) ✅
- Isolation / sharding / concurrency — DEFERRED to Phase 2 & 3 (out of scope here) ✅

**Placeholder scan:** No TBD/TODO. All code blocks complete. All commands concrete.

**Type/name consistency:** `fetchWithTimeout(url, options, {timeoutMs, retries})` defined in Task 1, used consistently. `waitForAppReady(page, role)` defined in Task 4, used in Task 5. `test`/`expect` imported from `./fixtures.js` in Tasks 5 & 6 exactly as exported in Task 3.

**Green-on-current-setup check:** No test data IDs changed; CI stays single-shard serial. `waitForAppReady` admin selector is `#user-list table tr` — verified against `admin.html`'s `renderUsers()` which builds a `<table>` of `<tr>` rows inside `#user-list`.
