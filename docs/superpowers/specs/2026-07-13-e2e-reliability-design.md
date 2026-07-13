# E2E Reliability, Isolation & Concurrency Coverage — Design

**Date:** 2026-07-13
**Status:** Approved design, pending implementation plan

## Goal

Make the E2E suite **reliable, fast, isolated, and diagnosable**, and add **deliberate concurrency/real-time coverage** for the app's highest-risk behaviors (multi-user contention, overwrite conflicts, live sync). Fix the root causes of the current mass flakiness rather than patching selectors commit-by-commit.

## Background — root cause analysis

The E2E suite was green at commit `19:19` (2026-07-13), then went red at `19:24` — a commit that changed *only* map SVG geometry. That run failed 57/65 tests including `admin-users`, `incidents`, `register`, `auth` — pages a geometry change cannot affect. All failed with the **same** error: `page.waitForURL: Timeout 45000ms exceeded` at `tests/e2e/helpers.js:10` (browser login never redirects).

Meanwhile the CI "Test worker login" curl step succeeds in ~1.2s every run. So the backend is healthy when hit directly, but the **browser login `fetch` intermittently hangs** over the ~24-minute serial run.

**Three distinct problems, stacked:**

1. **No fetch timeout + flaky shared backend.** `workerRequest` (`js/api.js:208`) calls `fetch` with no `AbortController`. When the Cloudflare worker cold-starts or Supabase throttles, the browser `await` hangs the full 45s → login never redirects → cascade of timeouts. This is the dominant cause and is environmental, not code.
2. **`waitForLoadState('networkidle')` is fundamentally broken here.** Both `parking.html:144` and `admin.html:193` run a `setInterval(refresh, 30000)` poll, so the network never idles. The team already removed `networkidle` from most specs (see comments in `admin-mutations`, `admin-payments`, `acceptance-admin`), but it still remains in `spots.spec.js:11`, `access-control.spec.js:25`, `access-control.spec.js:38`.
3. **Mobile-first UI selector changes** (`#info-panel` → hidden, `#residents-toggle`/`#residents-panel` removed). Already fixed in commit `2fd753c`.

## Key facts that constrain the design

- **Worker = single deployment, one DB per env.** `worker/park-management-api/wrangler.jsonc` binds `SUPABASE_URL` at deploy time (staging → `yuoqbjopaemikxiwvtup`). Runtime reads `env.SUPABASE_SERVICE_KEY`. Browser + worker both hit **one shared staging Supabase project**.
- **All worker queries are ID/filter-scoped** (e.g. `spots?id=eq.s1`, `payments?spotId=eq.X&month=eq.Y`). This means **row-namespacing by ID prefix works with zero worker changes** — each shard uses distinct IDs and queries never collide.
- **No dedicated health endpoint** on the worker. Warm-up uses `POST /auth/login` (already in CI) as a fail-fast gate.
- **Real-time = 30s polling**, not websockets. All test waits must be explicit element/state waits.
- **~14 spec files, ~73 tests.** Most are read-only; a few mutate shared state (`admin-mutations`, `sync`, `admin-payments-mutations`, `register` submission, `incidents` submit) — this is what forces serial execution today.

## Architecture

Three Playwright projects, one resilient client, one observability fixture, namespaced seed/teardown, matrix-sharded + paths-gated CI.

```
┌──────────────────────────────────────────────────────────────┐
│ CI (GitHub Actions)                                            │
│                                                                │
│  paths filter ── CSS/docs only ──► smoke job (2 min gate)      │
│              └── backend/js/tests ─► full matrix (N shards)    │
│                                                                │
│  matrix shard i/N:                                             │
│    seed(SHARD_ID=i) → playwright --shard=i/N → teardown(i)     │
│                                                                │
│  concurrency job (serial, own namespace):                      │
│    seed(SHARD_ID=concurrency) → playwright project=concurrency │
│                                                                │
│  nightly: full matrix + concurrency                            │
└──────────────────────────────────────────────────────────────┘
```

### Playwright projects

| Project | Workers | Purpose | Retries (CI) |
|---------|---------|---------|--------------|
| `smoke` | 1 | 3–5 core flows (login, map renders, admin table loads). Fast merge gate for non-backend commits. | 2 |
| `parallel` | sharded via matrix | All correctness specs. Each shard isolated by ID namespace. | 2 |
| `concurrency` | 1 (serial) | Deliberate multi-actor races, overwrite conflicts, real-time sync. | 1 |

## Component design

### 1. Resilient `workerRequest` (P0)

Modify `js/api.js` `workerRequest` and the raw `fetch` calls in `_get/_upsert/_delete/_patch` and `_tryRefresh` to use a shared `fetchWithTimeout` helper:

- `AbortController` with a **10s timeout** per attempt.
- **One retry** on network error or timeout, with ~500ms backoff. (Do NOT retry on a definitive HTTP error like 400/401/403 — only on transport failure/timeout.)
- On final failure, throw a clear error (`Network timeout` / original message).

This is a production improvement, not just a test fix: real users on a cold worker currently hang indefinitely.

### 2. Determinism

- **Remove** `waitForLoadState('networkidle')` from `spots.spec.js:11`, `access-control.spec.js:25`, `access-control.spec.js:38`.
- **Add** `waitForAppReady(page, role)` to `tests/e2e/helpers.js`:
  - renter/parking → wait for `svg g[data-id]` count ≥ 1 (map rendered).
  - admin → wait for the users table to have ≥ 1 row.
  - Uses Playwright web-first assertions with bounded timeout (15s).
- Replace ad-hoc waits in specs with `waitForAppReady`.

### 3. Observability fixture

New file `tests/e2e/fixtures.js` exporting an extended `test` with an **auto-use fixture** that:
- Registers `page.on('console', ...)`, `page.on('pageerror', ...)`, and `page.on('requestfailed', ...)`, buffering messages.
- Captures `response` bodies for 4xx/5xx.
- On test failure (`testInfo.status !== testInfo.expectedStatus`), attaches the buffered console + failed-request log + response bodies to the report via `testInfo.attach`.

All specs import `test`/`expect` from `./fixtures.js` instead of `@playwright/test`.

### 4. Isolation via ID namespacing

- **Namespace scheme:** a shard id `k` (e.g. `0..N-1`, plus `concurrency`, `smoke`) produces prefixed IDs:
  - spots: `sk-s1` … `sk-s22`, `sk-sA`, `sk-sB` (label unchanged; only `id` prefixed)
  - users: `sk-u-admin`, `sk-u-master`, `sk-u-renter-a`, …
  - plates/usernames: `HD-{K}A-001` etc. where `{K}` is a shard-unique letter/number segment so login usernames don't collide
  - auth emails: `hd-{k}a-001@park.local`
  - invites/payments/incidents/pending: same prefixing on `id` and cross-refs (`spotId`, `userId`, `token`)
- **`seed.js`** reads `SHARD_ID` env, builds all IDs from a single `namespace(shardId)` helper, seeds only that namespace.
- **`teardown.js`** deletes only rows whose `id` starts with the shard prefix (via `id=like.sk-*` PostgREST filter) and only auth users whose email carries the shard segment. Parallel teardowns never wipe siblings.
- **Spec fixtures**: a per-shard constants module `tests/e2e/ns.js` exports the resolved IDs/usernames for the current `SHARD_ID`; specs reference `NS.renterAUser` etc. instead of hardcoded `HD-AA-001`.

### 5. CI matrix sharding

- `.github/workflows/ci.yml` `e2e-tests` job becomes a `strategy.matrix` over `shard: [1,2,3,4]` (N=4 to start).
- **Schema application runs once** in a dedicated `e2e-setup` job (applies `db/schema.sql` to the shared staging DB). The matrix `e2e-shard` job declares `needs: e2e-setup` so schema is applied exactly once before any shard starts.
- **Each matrix shard job** then: overwrite `js/config.js` with staging creds → seed with `SHARD_ID=shard{i}` (its own namespace) → `npm run test:e2e -- --project=parallel --shard=i/N` → teardown its namespace.
- Because shards use disjoint ID namespaces on the shared schema, there is no cross-shard data race despite sharing one Supabase project.

### 6. Concurrency & real-time suite (assert **correct** behavior)

New specs under `tests/e2e/concurrency/` in the `concurrency` project (serial, own namespace). Written to assert the *correct* outcome — if the app currently mishandles concurrency, the test fails and exposes a real bug to fix.

- **Admin-vs-renter race**: two browser contexts. Admin releases spot X; renter has X open and attempts an action. Assert a single consistent final state (no phantom occupancy, no orphaned assignment).
- **Overwrite / stale-write plausibility**: two admin contexts edit the same spot's rent. Assert the second write does not silently clobber without the app's intended conflict signal (final value is deterministic and both writes are accounted for).
- **Real-time propagation**: admin marks a payment paid in context A; context B (renter) sees the update after a bounded refresh. Because sync is 30s polling, the test triggers an explicit reload to bound the wait rather than sleeping 30s.

### 7. Cost control

- `ci.yml` `on.push.paths` gating:
  - Full E2E matrix + concurrency run when any of `worker/**`, `js/**`, `db/**`, `tests/e2e/**`, `*.html` change.
  - Otherwise (pure CSS/docs), run only the `smoke` project as the merge gate.
- Add a nightly `schedule` trigger running the full matrix + concurrency to catch environment drift.

## Files changed / created

| File | Change |
|------|--------|
| `js/api.js` | Add `fetchWithTimeout` (AbortController 10s + 1 retry); route `workerRequest` and REST helpers through it |
| `playwright.config.js` | Define 3 projects (`smoke`, `parallel`, `concurrency`); `retries: CI?2:0`; keep serial for concurrency |
| `tests/e2e/helpers.js` | Add `waitForAppReady`; keep `loginAs` but lower timeout to 15s and use namespaced creds |
| `tests/e2e/fixtures.js` | NEW — observability fixture, re-exports `test`/`expect` |
| `tests/e2e/ns.js` | NEW — resolves namespaced IDs/usernames from `SHARD_ID` |
| `tests/fixtures/seed.js` | Parameterize by `SHARD_ID`; build IDs via `namespace()` |
| `tests/fixtures/teardown.js` | Delete only current shard's rows (prefix filter) + auth users |
| `tests/e2e/*.spec.js` | Import from `./fixtures.js`; use `NS.*` IDs; remove `networkidle`; use `waitForAppReady` |
| `tests/e2e/concurrency/*.spec.js` | NEW — 3 concurrency/real-time specs |
| `.github/workflows/ci.yml` | Matrix shards; paths gating; smoke gate; nightly schedule; fail-fast warm-up |

## Non-goals

- No websocket/real-time rewrite of the app (polling stays).
- No ephemeral Supabase-project-per-run (shared DB + namespacing chosen deliberately to preserve shared-state testability).
- No worker query-scoping changes (ID-filtering already suffices for namespacing).

## Success criteria

- A clean run is green and stays green across repeated runs (no environmental flakiness).
- Full suite wall-clock drops from ~24 min to single digits via 4-way sharding.
- A failing test's report shows the underlying console/network error, not a bare timeout.
- Concurrency suite exists and either passes (behavior correct) or fails loudly on a real concurrency bug.
- Pure-CSS/docs commits no longer trigger the 24-min backend suite.
