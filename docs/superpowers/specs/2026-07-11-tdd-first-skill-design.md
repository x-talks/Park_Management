# TDD-First Skill Design

**Date:** 2026-07-11
**Status:** Approved
**Scope:** Global discipline skill + project-local adapter for Park Management; reusable across all future web applications

---

## Problem Statement

As of 2026-07-11, the Park Management app has ~31% E2E test coverage. Mutations, access control, multi-user sync, and acceptance flows are largely untested. More critically, there is no enforced workflow that prevents shipping a new feature without tests — tests are written as an afterthought, if at all. This design specifies a skill that makes test-first development the only possible way to build features.

---

## Goals

1. Every new feature ships with all applicable test layers passing in CI — by construction, not by discipline
2. The skill is stack-agnostic and reusable across all future projects (React/TS/Vite/Tailwind, Cloudflare Workers, Supabase, etc.)
3. Zero manual maintenance — the project adapter auto-generates and auto-updates from the actual codebase
4. Existing coverage gaps on current and future codebases can be remediated via audit mode
5. The skill bootstraps test infrastructure from scratch on new projects

---

## Architecture

### Two files, one trigger

```
~/.claude/skills/tdd-first.md                        ← global discipline (stable)
<project>/.claude/skills/tdd-first-adapter.md        ← stack adapter (auto-generated)
```

**Global skill** (`~/.claude/skills/tdd-first.md`):
- Defines the 7-layer testing pyramid
- Defines the Red/Green/Refactor/CI protocol
- Defines the bootstrap procedure for new projects
- Defines the coverage audit mode
- Defines the adapter specification (what sections it must contain)
- Never manually edited — only updated when the discipline itself evolves

**Project adapter** (`.claude/skills/tdd-first-adapter.md`):
- Auto-generated on first TDD session in any project
- Derived entirely from `package.json`, config files, existing tests, schema, API layer
- Auto-updated after every feature when new patterns are introduced
- Committed to git — part of the project, not personal config
- Never manually edited

### Trigger

Any message containing: "add [feature]", "build [feature]", "implement [feature]", "new feature", "create [feature]", "I want [feature]", "test coverage", "coverage audit", "what's missing", "retroactive tests"

---

## The 7-Layer Testing Pyramid

All layers use Playwright (browser + request context) and Vitest. All run in CI.

| Layer | Name | Scope | Required When |
|-------|------|-------|--------------|
| L1 | Unit | Pure functions, validators, calculations, state transitions | Always |
| L2 | Component | Individual UI components in isolation | Always |
| L3 | Integration | API + DB boundary, RLS policies, token flows | API/RLS/schema touched |
| L4 | System / E2E | Full browser stack, CRUD mutations, real DB | Always |
| L5 | Access Control | Every role × every action (allowed + denied) | Any permission boundary |
| L6 | Multi-User Sync | Two simultaneous sessions, shared mutable state | Shared mutable state |
| L7 | Acceptance | Complete user journey from entry point to goal | Always |

### Layer tooling (this project)

| Layer | Tool |
|-------|------|
| L1 | Vitest + jsdom |
| L2 | Vitest + jsdom (vanilla); Vitest + RTL (React when added) |
| L3 | Playwright `request` context (no browser) |
| L4 | Playwright browser (Chromium) |
| L5 | Playwright browser, multiple `page` instances with different roles |
| L6 | Playwright `browser.newContext()` × 2 |
| L7 | Playwright browser (full journey) |

---

## The TDD Protocol

### Step 1 — Contract Definition
Read feature request → identify applicable layers → enumerate all CRUD ops, role boundaries, shared-state scenarios, user journeys → output Test Plan → **wait for user confirmation**

### Step 2 — RED
Write all test files → run suite → verify every new test fails for the right reason (feature absent, not syntax error) → **no implementation code until all are red**

### Step 3 — GREEN
Write minimum implementation → run suite after every change → all new tests green, no regressions

### Step 4 — REFACTOR
Clean up implementation under green → revert immediately if any test goes red

### Step 5 — CI Gate
Push → CI green on all layers → feature is done only when CI passes

### Step 6 — Adapter Update
If new patterns introduced → rewrite affected adapter sections → commit

---

## Coverage Audit Mode

On existing codebases:
1. Enumerate all features from HTML, JS/TS, API routes, schema
2. Enumerate all existing tests
3. Produce gap matrix (per feature × per layer: ✓ / ✗ / ⚠ / n/a)
4. Prioritize: P1 access control + mutations, P2 sync + acceptance, P3 unit + component
5. Write missing tests in priority order
6. Update adapter with new patterns

---

## Bootstrap for New Projects

On first use in a project with no adapter:
1. Detect adapter — if missing, generate it from project files
2. If staging infrastructure missing: announce checklist, scaffold seed file, generate CI additions, list required secrets
3. Do not proceed with TDD protocol until infrastructure confirmed

---

## Self-Maintenance Contract

The adapter is always derived from what actually exists in the project:
- New dep in `package.json` → adapter stack inventory updated
- New test helper → adapter auth/selector sections updated
- New table in schema → adapter seed patterns updated
- New role → adapter access control section updated

Claude rewrites the adapter, commits it. The user never touches it.

---

## Files

| File | Purpose |
|------|---------|
| `~/.claude/skills/tdd-first.md` | Global discipline skill |
| `.claude/skills/tdd-first-adapter.md` | Project-local stack adapter (auto-generated) |
| `docs/superpowers/specs/2026-07-11-tdd-first-skill-design.md` | This document |

---

## Current Coverage Gap (Park Management, 2026-07-11)

~31% overall. Priority gaps for retroactive remediation:

| Priority | Gap |
|----------|-----|
| P1 | Admin mutations: approve/reject pending registration, activate/deactivate user, edit user, delete user, generate invite, assign/unassign spot, reserve/unreserve spot |
| P1 | Payment mutations: mark paid, revert payment |
| P1 | Access control: renter blocked from admin mutations, renter sees only own incidents |
| P2 | Multi-user sync: admin marks paid → renter sees updated status |
| P2 | Acceptance: full renter journey (login → map → profile edit → view payments) |
| P2 | Acceptance: full admin journey (login → invite → approve registration → mark paid) |
| P2 | register.html 3-step registration wizard (zero coverage) |
| P3 | Parking map interactions (info panel, residents list, profile edit) |
| P3 | Incident log (populated data, lightbox, admin delete, access control) |

---

## Applicability to Future Projects

This skill applies out-of-the-box to any web application:

| Stack | L1 | L2 | L3 | L4 | L5 | L6 | L7 |
|-------|----|----|----|----|----|----|-----|
| Vanilla JS + Supabase (this project) | Vitest | Vitest+jsdom | Playwright request | Playwright | Playwright | Playwright dual-ctx | Playwright |
| React + TS + Vite + Tailwind | Vitest | Vitest+RTL | Playwright request | Playwright | Playwright | Playwright dual-ctx | Playwright |
| Next.js + Prisma | Vitest/Jest | Vitest+RTL | Playwright request | Playwright | Playwright | Playwright dual-ctx | Playwright |
| Any stack | Vitest/Jest | Vitest+RTL or jsdom | Playwright request | Playwright | Playwright | Playwright dual-ctx | Playwright |

The adapter auto-detects and fills in the specifics for each row.
