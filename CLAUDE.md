# Park Management — Claude Code Context

## Project Overview

Parking management web app for a residential building. Renters register spots, admins manage assignments and payments. Multi-language (EN/DE/TR). PWA.

**Architecture:** Vanilla JS frontend (no framework, no build) → Cloudflare Worker API → Supabase PostgreSQL.

Reads: browser → Supabase REST (anon key + RLS)  
Writes: browser → Cloudflare Worker → Supabase REST (service role key)

---

## Repo Layout

```
/
├── *.html              — SPA pages (index, admin, invite, incident, profile)
├── js/                 — Frontend ES modules (no bundler)
│   ├── config.js       — Supabase URL/key + Worker URL constants
│   ├── api.js          — All fetch() calls (Worker + Supabase)
│   ├── auth.js         — Session management (sessionStorage + JWT)
│   ├── admin.js        — Admin panel logic
│   ├── parking.js      — Renter view + SVG map
│   ├── invite.js       — Registration flow
│   ├── i18n.js         — i18n runtime (t('key', {0}, {1}))
│   └── i18n/           — en.js / de.js / tr.js locale strings
├── css/style.css       — Single shared stylesheet
├── db/schema.sql       — Canonical Supabase schema (apply via CI or Management API)
├── worker/park-management-api/
│   └── src/index.js    — Cloudflare Worker (752 lines, plain JS, all API routes)
├── tests/
│   ├── unit/           — Vitest + jsdom unit tests
│   ├── e2e/            — Playwright E2E specs (14 files)
│   │   ├── helpers.js  — loginAs(), waitForAppReady()
│   │   └── fixtures.js — Shared test data constants
│   └── fixtures/       — Global setup/teardown, seed.js, staging-config.js
├── .github/workflows/
│   ├── ci.yml          — unit → E2E → deploy (main only)
│   └── deploy.yml      — Manual emergency redeploy
├── playwright.config.js
├── vitest.config.js
└── .env.test           — Staging env vars (non-secret keys only)
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run test:unit` | Vitest unit tests (run after every JS change) |
| `npm run test:e2e` | Playwright E2E against staging |
| `npm run test:all` | Unit + E2E |
| `npx serve . -l 3000` | Local dev server (no build needed) |
| `cd worker/... && npm run dev` | Wrangler local worker dev |
| `cd worker/... && npm run deploy` | Deploy worker to Cloudflare |

---

## Deployment

**Frontend:** GitHub Pages. CI deploys on every push to `main` after unit tests pass. No build step — entire repo root is the artifact.

**Worker:** Cloudflare Workers.
- Production: `https://park-management-api.aenumina.workers.dev`
- Staging: `https://park-management-api-staging.aenumina.workers.dev`
- Deploy: `wrangler deploy` from `worker/park-management-api/`

**Supabase:**
- Production project ID: `fnluagvzowbcuzlblfmr`
- Staging project ID: `yuoqbjopaemikxiwvtup`
- Schema applied via CI (`db/schema.sql`) using Supabase Management API

---

## Testing Rules

1. **Always run `npm run test:unit` after any JS change** — never tell the user to run it.
2. E2E hits the real staging Cloudflare Worker and Supabase — no mocks.
3. E2E env vars come from `.env.test` (local) or CI secrets (GitHub Actions).
4. Required secrets: `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_KEY`, `STAGING_WORKER_URL`, `STAGING_ADMIN_PASSWORD`, `STAGING_MASTER_PASSWORD`.
5. Worker cold-starts can cause 15–25s delays — `loginAs` timeout is 25s, global test timeout is 35s.
6. `buildSVG()` is async — `#parking-svg` visible ≠ `g[data-id]` populated. Always wait: `await expect(page.locator('svg g[data-id]').first()).toBeVisible({ timeout: 15_000 })`.
7. CI config: `retries: 0`, `maxFailures: 1` (stop on first failure), Playwright cache keyed on `package-lock.json`.
8. Schema applied to staging only when `db/schema.sql` changes (or on every PR).

---

## Worker API Routes

All writes must go through the Worker (service role key lives there).

```
POST   /auth/login                         — returns JWT accessToken
POST   /auth/logout
GET    /users                              — admin/master only
POST   /users                              — direct create user (master)
GET    /users/:id
PATCH  /users/:id
PATCH  /users/:id/password
PATCH  /users/:id/role
GET    /spots
PATCH  /spots/:id
POST   /spots/:id/assign
POST   /spots/:id/release
GET    /payments
POST   /payments
PATCH  /payments/:id
GET    /invites
POST   /invites
DELETE /invites/:id
GET    /pending-registrations
POST   /pending-registrations/:id/approve
GET    /incidents
POST   /incidents
PATCH  /incidents/:id
POST   /admin/migrate-user/:id
```

Auth roles: `renter`, `admin`, `master`. JWT verified in-worker (HS256 or ES256/JWKS).

---

## SVG Parking Map

The parking map is rendered via `buildSVG()` in `js/parking.js`. Geometry constants (locked — do not change without explicit approval):

- `wall=27`, `span=67`, `step=34`, `gap=7`
- Equal 7px margins
- Spots 1–22 + sA + sB (24 total)

---

## i18n

Keys use dot notation: `t('reg.payment.notice')`. Interpolation: `t('key', value0, value1)` maps to `{0}`, `{1}` in the string. Locale files: `js/i18n/en.js`, `de.js`, `tr.js`. Language stored in `localStorage`. `langchange` custom event triggers re-render.

---

## Conventions

- No build step on the frontend — files are served as-is.
- `js/config.js` is the single source for env-specific URLs/keys (frontend).
- `worker/park-management-api/wrangler.jsonc` holds Worker env vars (non-secret).
- Worker secrets (`SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`) pushed via `scripts/push-secrets.sh`.
- The stub `worker/park-management-api/src/index.ts` is unused — real code is `index.js`.
- Worker unit tests in `worker/.../test/index.spec.ts` are scaffold stubs — not real coverage.
- File size limit: 250 lines per source file. If approaching limit, extract pure helper functions.
- TypeScript strictly prohibited on frontend (vanilla JS). Worker source is also plain JS.

---

## Git

- Branch `feat/react-migration` is the active development branch.
- `main` triggers production deploy to GitHub Pages.
- Commit format: `feat:`, `fix:`, `refactor:`, `ci:`, `test:` (conventional commits).
- After every significant change: `git add <files> && git commit -m "..." && git push`.
