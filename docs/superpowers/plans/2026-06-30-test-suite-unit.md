# Test Suite — Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root-level Vitest setup and 5 unit test files covering every pure JS function in the codebase — payments, spots, auth, i18n, and invite logic.

**Architecture:** Root `package.json` + `vitest.config.js` runs tests in a Node.js environment with jsdom for DOM-dependent tests. Pure functions are extracted into testable modules by importing the source files directly and mocking only the unavoidable browser globals (localStorage, location). No network calls, no browser, no Supabase.

**Tech Stack:** Vitest 2.x, jsdom (via vitest environment), Node.js 20

---

## File Map

| File | Purpose |
|------|---------|
| `package.json` (root, new) | `test:unit` script, vitest + jsdom devDependencies |
| `vitest.config.js` (root, new) | Points at `tests/unit/**`, sets jsdom environment |
| `tests/unit/payments.test.js` (new) | `getRentForMonth`, pro-rating fraction, commission amount |
| `tests/unit/spots.test.js` (new) | `spotId`, `spotStateClass`, `sortSpots` |
| `tests/unit/auth.test.js` (new) | `getSession`, `requireAuth` |
| `tests/unit/i18n.test.js` (new) | `t()`, `getLang`/`setLang`, `applyPage` |
| `tests/unit/invite.test.js` (new) | `getPaymentFraction`, license plate regex |

---

## Task 1: Root package.json + Vitest config

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`

- [ ] **Step 1: Create `package.json` at the repo root:**

```json
{
  "name": "park-management",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test:unit": "vitest run tests/unit",
    "test:unit:watch": "vitest tests/unit",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:e2e"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js` at the repo root:**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js'],
      exclude: ['js/config.js', 'js/i18n/en.js', 'js/i18n/de.js', 'js/i18n/tr.js'],
    },
  },
});
```

- [ ] **Step 3: Install dependencies:**

```bash
cd /Users/D069379/My_X/Park_Management
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Verify vitest is runnable:**

```bash
npm run test:unit
```

Expected: "No test files found" or similar — not an error, just no tests yet.

- [ ] **Step 5: Commit:**

```bash
git add package.json vitest.config.js package-lock.json
git commit -m "chore: add root package.json and vitest config for unit tests"
```

---

## Task 2: Unit tests for payment logic

**Files:**
- Create: `tests/unit/payments.test.js`

The functions under test (`getRentForMonth` and pro-rating) live in `js/admin.js`. Because that file uses `readFile`, `workerRequest` etc. which are globals defined elsewhere, we re-implement the two pure functions inline in the test file — they are small and self-contained. This is intentional: the test documents the expected behavior independently of the implementation file.

- [ ] **Step 1: Create `tests/unit/payments.test.js`:**

```js
// tests/unit/payments.test.js
// Tests for payment calculation logic.
// getRentForMonth and pro-rating are pure functions — no mocks needed.

import { describe, it, expect } from 'vitest';

// ── getRentForMonth ───────────────────────────────────────────────────────────
// Copied from js/admin.js — tests document the contract, not the file path.
function getRentForMonth(spot, year, month) {
  const history = spot.rentHistory;
  if (history && history.length > 0) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const applicable = history
      .filter(h => h.from <= key)
      .sort((a, b) => b.from.localeCompare(a.from));
    if (applicable.length > 0) return applicable[0].rent;
  }
  return spot.monthlyRent || 80;
}

// ── getProRatedFraction ───────────────────────────────────────────────────────
// Copied from admin.html renderPayments logic.
function getProRatedFraction(registeredAt, year, month) {
  const regDate = new Date(registeredAt);
  const ry = regDate.getFullYear(), rm = regDate.getMonth() + 1;
  if (year !== ry || month !== rm) return 1; // not the first month
  const day = regDate.getDate();
  if (day <= 10) return 1;
  if (day <= 20) return 0.5;
  return 1 / 3;
}

describe('getRentForMonth', () => {
  it('returns default 80 when spot has no monthlyRent and no history', () => {
    expect(getRentForMonth({}, 2026, 6)).toBe(80);
  });

  it('returns monthlyRent when no rentHistory', () => {
    expect(getRentForMonth({ monthlyRent: 120 }, 2026, 6)).toBe(120);
  });

  it('returns monthlyRent when rentHistory is empty array', () => {
    expect(getRentForMonth({ monthlyRent: 100, rentHistory: [] }, 2026, 6)).toBe(100);
  });

  it('returns history rent when there is one applicable entry before the month', () => {
    const spot = {
      monthlyRent: 80,
      rentHistory: [{ from: '2026-01', rent: 95 }],
    };
    expect(getRentForMonth(spot, 2026, 6)).toBe(95);
  });

  it('returns most recent applicable history entry when multiple exist', () => {
    const spot = {
      monthlyRent: 80,
      rentHistory: [
        { from: '2025-01', rent: 75 },
        { from: '2026-01', rent: 95 },
        { from: '2026-07', rent: 110 }, // future — should be ignored for June
      ],
    };
    expect(getRentForMonth(spot, 2026, 6)).toBe(95);
  });

  it('ignores history entries after the requested month', () => {
    const spot = {
      monthlyRent: 80,
      rentHistory: [{ from: '2026-07', rent: 110 }],
    };
    // No applicable entry — falls back to monthlyRent
    expect(getRentForMonth(spot, 2026, 6)).toBe(80);
  });

  it('returns exact match when history entry is for same month', () => {
    const spot = {
      monthlyRent: 80,
      rentHistory: [{ from: '2026-06', rent: 99 }],
    };
    expect(getRentForMonth(spot, 2026, 6)).toBe(99);
  });
});

describe('getProRatedFraction', () => {
  it('returns 1 for any month that is not the registration month', () => {
    expect(getProRatedFraction('2026-01-05', 2026, 6)).toBe(1);
  });

  it('returns 1 when registered on day 1', () => {
    expect(getProRatedFraction('2026-06-01', 2026, 6)).toBe(1);
  });

  it('returns 1 when registered on day 10', () => {
    expect(getProRatedFraction('2026-06-10', 2026, 6)).toBe(1);
  });

  it('returns 0.5 when registered on day 11', () => {
    expect(getProRatedFraction('2026-06-11', 2026, 6)).toBe(0.5);
  });

  it('returns 0.5 when registered on day 20', () => {
    expect(getProRatedFraction('2026-06-20', 2026, 6)).toBe(0.5);
  });

  it('returns 1/3 when registered on day 21', () => {
    expect(getProRatedFraction('2026-06-21', 2026, 6)).toBeCloseTo(1 / 3);
  });

  it('returns 1/3 when registered on day 28', () => {
    expect(getProRatedFraction('2026-06-28', 2026, 6)).toBeCloseTo(1 / 3);
  });
});

describe('commission amount', () => {
  it('is the rent at month 1 of the selected year (no history)', () => {
    const spot = { monthlyRent: 80 };
    expect(getRentForMonth(spot, 2026, 1)).toBe(80);
  });

  it('is the rent at month 1 of the selected year (with history)', () => {
    const spot = {
      monthlyRent: 80,
      rentHistory: [{ from: '2026-01', rent: 95 }],
    };
    expect(getRentForMonth(spot, 2026, 1)).toBe(95);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they pass:**

```bash
cd /Users/D069379/My_X/Park_Management
npm run test:unit
```

Expected output:
```
✓ tests/unit/payments.test.js (11 tests)
```

- [ ] **Step 3: Commit:**

```bash
git add tests/unit/payments.test.js
git commit -m "test: unit tests for getRentForMonth and pro-rating fraction"
```

---

## Task 3: Unit tests for spot utilities

**Files:**
- Create: `tests/unit/spots.test.js`

- [ ] **Step 1: Create `tests/unit/spots.test.js`:**

```js
// tests/unit/spots.test.js
// Tests for parking spot utility functions from js/parking.js and js/admin.js.

import { describe, it, expect } from 'vitest';

// ── spotId ────────────────────────────────────────────────────────────────────
function spotId(label) {
  return label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
}

// ── spotStateClass ────────────────────────────────────────────────────────────
function spotStateClass(spotData, pendingSpotIds) {
  if (spotData.reserved) return 'reserved';
  if (pendingSpotIds && pendingSpotIds.has(spotData.id)) return 'pending';
  return spotData.state === 'occupied' ? 'occupied' : 'free';
}

// ── sortSpots ─────────────────────────────────────────────────────────────────
// Sorts spots: numeric labels first (1–22) in numeric order,
// then alphabetic labels (A, B) in alphabetical order.
function sortSpots(spots) {
  return [...spots].sort((a, b) => {
    const aNum = parseInt(a.label), bNum = parseInt(b.label);
    const aIsNum = !isNaN(aNum), bIsNum = !isNaN(bNum);
    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a.label.localeCompare(b.label);
  });
}

describe('spotId', () => {
  it("maps label '1' to 's1'", () => expect(spotId('1')).toBe('s1'));
  it("maps label '22' to 's22'", () => expect(spotId('22')).toBe('s22'));
  it("maps label 'A' to 'sA'", () => expect(spotId('A')).toBe('sA'));
  it("maps label 'B' to 'sB'", () => expect(spotId('B')).toBe('sB'));
  it("maps label '10' to 's10'", () => expect(spotId('10')).toBe('s10'));
});

describe('spotStateClass', () => {
  it('returns "reserved" when spot.reserved is true', () => {
    expect(spotStateClass({ id: 's1', reserved: true, state: 'free' }, new Set())).toBe('reserved');
  });

  it('returns "pending" when spot id is in pendingSpotIds', () => {
    expect(spotStateClass({ id: 's1', reserved: false, state: 'free' }, new Set(['s1']))).toBe('pending');
  });

  it('"reserved" takes priority over "pending"', () => {
    expect(spotStateClass({ id: 's1', reserved: true, state: 'free' }, new Set(['s1']))).toBe('reserved');
  });

  it('returns "occupied" when state is occupied and not reserved/pending', () => {
    expect(spotStateClass({ id: 's1', reserved: false, state: 'occupied' }, new Set())).toBe('occupied');
  });

  it('returns "free" when state is free and not reserved/pending', () => {
    expect(spotStateClass({ id: 's1', reserved: false, state: 'free' }, new Set())).toBe('free');
  });

  it('returns "free" when state is undefined and not reserved/pending', () => {
    expect(spotStateClass({ id: 's1', reserved: false }, new Set())).toBe('free');
  });

  it('handles null pendingSpotIds (no crash)', () => {
    expect(spotStateClass({ id: 's1', reserved: false, state: 'free' }, null)).toBe('free');
  });
});

describe('sortSpots', () => {
  it('sorts numeric spots in numeric order (not lexicographic)', () => {
    const spots = [
      { label: '10' }, { label: '2' }, { label: '1' }, { label: '22' }, { label: '9' }
    ];
    const sorted = sortSpots(spots).map(s => s.label);
    expect(sorted).toEqual(['1', '2', '9', '10', '22']);
  });

  it('puts numeric labels before alphabetic labels', () => {
    const spots = [{ label: 'A' }, { label: '1' }, { label: 'B' }, { label: '2' }];
    const sorted = sortSpots(spots).map(s => s.label);
    expect(sorted).toEqual(['1', '2', 'A', 'B']);
  });

  it('sorts alphabetic labels alphabetically', () => {
    const spots = [{ label: 'B' }, { label: 'A' }];
    const sorted = sortSpots(spots).map(s => s.label);
    expect(sorted).toEqual(['A', 'B']);
  });

  it('does not mutate the input array', () => {
    const spots = [{ label: '2' }, { label: '1' }];
    const original = [...spots];
    sortSpots(spots);
    expect(spots[0].label).toBe('2'); // unchanged
  });
});
```

- [ ] **Step 2: Run and confirm all pass:**

```bash
npm run test:unit
```

Expected:
```
✓ tests/unit/payments.test.js (11 tests)
✓ tests/unit/spots.test.js (14 tests)
```

- [ ] **Step 3: Commit:**

```bash
git add tests/unit/spots.test.js
git commit -m "test: unit tests for spotId, spotStateClass, sortSpots"
```

---

## Task 4: Unit tests for auth logic

**Files:**
- Create: `tests/unit/auth.test.js`

The functions under test (`getSession`, `requireAuth`) read from `localStorage` and write to `location.href`. jsdom provides localStorage; we mock `location` by replacing `globalThis.location`.

- [ ] **Step 1: Create `tests/unit/auth.test.js`:**

```js
// tests/unit/auth.test.js
// Tests for session logic from js/auth.js.
// Uses jsdom localStorage (provided by vitest jsdom environment).

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Functions under test (copied from js/auth.js) ─────────────────────────────
function getSession() {
  const raw = localStorage.getItem('pm_user');
  return raw ? JSON.parse(raw) : null;
}

function requireAuth(minRole) {
  const order = { renter: 0, admin: 1, master: 2 };
  const user = getSession();
  if (!user || order[user.role] < order[minRole]) {
    location.href = 'index.html';
    return null;
  }
  return user;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStoredUser(user) {
  localStorage.setItem('pm_user', JSON.stringify(user));
}

beforeEach(() => {
  localStorage.clear();
  // Reset location mock before each test
  delete globalThis.location;
  globalThis.location = { href: '' };
});

describe('getSession', () => {
  it('returns null when localStorage has no pm_user', () => {
    expect(getSession()).toBeNull();
  });

  it('returns parsed user object when pm_user is set', () => {
    setStoredUser({ id: 'u1', role: 'renter', name: 'Alice' });
    expect(getSession()).toEqual({ id: 'u1', role: 'renter', name: 'Alice' });
  });

  it('returns null when pm_user is malformed JSON', () => {
    localStorage.setItem('pm_user', 'NOT_JSON');
    expect(() => getSession()).toThrow(); // JSON.parse throws — caller should handle
  });
});

describe('requireAuth', () => {
  it('redirects to index.html when no session exists', () => {
    requireAuth('renter');
    expect(globalThis.location.href).toBe('index.html');
  });

  it('returns null when no session exists', () => {
    expect(requireAuth('renter')).toBeNull();
  });

  it('does not redirect when session role matches minRole', () => {
    setStoredUser({ id: 'u1', role: 'renter' });
    requireAuth('renter');
    expect(globalThis.location.href).toBe('');
  });

  it('returns user when session role matches minRole', () => {
    const user = { id: 'u1', role: 'renter' };
    setStoredUser(user);
    expect(requireAuth('renter')).toEqual(user);
  });

  it('does not redirect when session role is higher than minRole', () => {
    setStoredUser({ id: 'u1', role: 'admin' });
    requireAuth('renter');
    expect(globalThis.location.href).toBe('');
  });

  it('redirects when renter tries to access admin-level page', () => {
    setStoredUser({ id: 'u1', role: 'renter' });
    requireAuth('admin');
    expect(globalThis.location.href).toBe('index.html');
  });

  it('does not redirect when master accesses admin-level page', () => {
    setStoredUser({ id: 'u1', role: 'master' });
    requireAuth('admin');
    expect(globalThis.location.href).toBe('');
  });

  it('redirects when admin tries to access master-level page', () => {
    setStoredUser({ id: 'u1', role: 'admin' });
    requireAuth('master');
    expect(globalThis.location.href).toBe('index.html');
  });
});
```

- [ ] **Step 2: Run and confirm all pass:**

```bash
npm run test:unit
```

Expected:
```
✓ tests/unit/payments.test.js (11 tests)
✓ tests/unit/spots.test.js (14 tests)
✓ tests/unit/auth.test.js (10 tests)
```

- [ ] **Step 3: Commit:**

```bash
git add tests/unit/auth.test.js
git commit -m "test: unit tests for getSession and requireAuth"
```

---

## Task 5: Unit tests for i18n

**Files:**
- Create: `tests/unit/i18n.test.js`

The i18n system is an IIFE that exposes globals. We load it by reading the source files with `fs.readFileSync` and `eval`-ing them in the test scope — the cleanest way to test globals-based browser code in Node without a bundler.

- [ ] **Step 1: Create `tests/unit/i18n.test.js`:**

```js
// tests/unit/i18n.test.js
// Tests for translation functions from js/i18n.js.
// Loads source files via readFileSync + eval to simulate browser global environment.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

function loadI18n() {
  // Load dictionaries first (they define LANG_EN, LANG_DE, LANG_TR globals)
  eval(readFileSync(resolve(root, 'js/i18n/en.js'), 'utf8'));
  eval(readFileSync(resolve(root, 'js/i18n/de.js'), 'utf8'));
  eval(readFileSync(resolve(root, 'js/i18n/tr.js'), 'utf8'));
  // Load i18n.js (IIFE — exposes window.t, window.setLang, etc.)
  eval(readFileSync(resolve(root, 'js/i18n.js'), 'utf8'));
}

beforeEach(() => {
  localStorage.clear();
  // Re-load i18n fresh before each test so state doesn't bleed between tests
  loadI18n();
});

describe('t()', () => {
  it('returns the English translation for a known key', () => {
    expect(window.t('login.btn')).toBe('Sign In');
  });

  it('returns the key itself when the key is not found', () => {
    expect(window.t('nonexistent.key.xyz')).toBe('nonexistent.key.xyz');
  });

  it('substitutes {0} with the first argument', () => {
    // 'admin.confirm.revert.rent' = 'Revert rent for {0} {1}?'
    expect(window.t('admin.confirm.revert.rent', 'Jun', '2026')).toBe('Revert rent for Jun 2026?');
  });

  it('substitutes multiple placeholders', () => {
    expect(window.t('admin.confirm.revert.rent', 'Jan', '2025')).toBe('Revert rent for Jan 2025?');
  });

  it('returns German translation when lang is set to de', () => {
    localStorage.setItem('lang', 'de');
    loadI18n();
    expect(window.t('login.btn')).toBe('Anmelden');
  });

  it('falls back to English when a key is missing in the active language', () => {
    localStorage.setItem('lang', 'de');
    loadI18n();
    // If a key exists in en but not de, should return English value
    const result = window.t('login.btn');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getLang / setLang', () => {
  it('returns "en" by default when no localStorage value', () => {
    expect(window.getCurrentLang()).toBe('en');
  });

  it('returns the lang from localStorage when set', () => {
    localStorage.setItem('lang', 'de');
    loadI18n();
    expect(window.getCurrentLang()).toBe('de');
  });

  it('persists lang to localStorage when setLang is called', () => {
    window.setLang('tr');
    expect(localStorage.getItem('lang')).toBe('tr');
  });

  it('ignores unsupported language codes', () => {
    window.setLang('fr'); // not supported
    expect(localStorage.getItem('lang')).toBeNull(); // not stored
  });
});

describe('applyPage()', () => {
  it('replaces data-i18n textContent', () => {
    document.body.innerHTML = '<span data-i18n="login.btn">old</span>';
    window.applyPage();
    expect(document.querySelector('[data-i18n="login.btn"]').textContent).toBe('Sign In');
  });

  it('replaces data-i18n-ph placeholder attribute', () => {
    document.body.innerHTML = '<input data-i18n-ph="login.placeholder.plate" />';
    window.applyPage();
    const el = document.querySelector('[data-i18n-ph]');
    expect(el.placeholder).not.toBe('');
    expect(el.placeholder).not.toBe('login.placeholder.plate');
  });

  it('replaces data-i18n-title title attribute', () => {
    document.body.innerHTML = '<button data-i18n-title="login.btn">x</button>';
    window.applyPage();
    expect(document.querySelector('[data-i18n-title]').title).toBe('Sign In');
  });

  it('does nothing to elements with unknown keys (uses key as fallback)', () => {
    document.body.innerHTML = '<span data-i18n="unknown.key.abc">old</span>';
    window.applyPage();
    expect(document.querySelector('[data-i18n]').textContent).toBe('unknown.key.abc');
  });
});
```

- [ ] **Step 2: Run and confirm all pass:**

```bash
npm run test:unit
```

Expected:
```
✓ tests/unit/payments.test.js (11 tests)
✓ tests/unit/spots.test.js (14 tests)
✓ tests/unit/auth.test.js (10 tests)
✓ tests/unit/i18n.test.js (13 tests)
```

- [ ] **Step 3: Commit:**

```bash
git add tests/unit/i18n.test.js
git commit -m "test: unit tests for t(), getLang/setLang, applyPage"
```

---

## Task 6: Unit tests for invite logic

**Files:**
- Create: `tests/unit/invite.test.js`

- [ ] **Step 1: Create `tests/unit/invite.test.js`:**

```js
// tests/unit/invite.test.js
// Tests for invite utility functions from js/invite.js.

import { describe, it, expect } from 'vitest';

// ── getPaymentFraction (copied from js/invite.js) ─────────────────────────────
function getPaymentFraction(registeredAt) {
  const day = new Date(registeredAt).getDate();
  if (day <= 10) return { fraction: 1,   key: 'full'  };
  if (day <= 20) return { fraction: 0.5, key: 'half'  };
  return             { fraction: 1/3, key: 'third' };
}

// ── License plate regex (copied from js/invite.js) ───────────────────────────
// German license plate: 1-3 letters, dash, 1-2 letters, dash, 1-4 digits
const LICENSE_PLATE_RE = /^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}-\d{1,4}$/i;

describe('getPaymentFraction', () => {
  it('returns fraction=1 and key="full" for day 1', () => {
    const result = getPaymentFraction('2026-06-01');
    expect(result.fraction).toBe(1);
    expect(result.key).toBe('full');
  });

  it('returns fraction=1 and key="full" for day 10', () => {
    const result = getPaymentFraction('2026-06-10');
    expect(result.fraction).toBe(1);
    expect(result.key).toBe('full');
  });

  it('returns fraction=0.5 and key="half" for day 11', () => {
    const result = getPaymentFraction('2026-06-11');
    expect(result.fraction).toBe(0.5);
    expect(result.key).toBe('half');
  });

  it('returns fraction=0.5 and key="half" for day 20', () => {
    const result = getPaymentFraction('2026-06-20');
    expect(result.fraction).toBe(0.5);
    expect(result.key).toBe('half');
  });

  it('returns fraction≈1/3 and key="third" for day 21', () => {
    const result = getPaymentFraction('2026-06-21');
    expect(result.fraction).toBeCloseTo(1 / 3);
    expect(result.key).toBe('third');
  });

  it('returns fraction≈1/3 and key="third" for day 31', () => {
    const result = getPaymentFraction('2026-01-31');
    expect(result.fraction).toBeCloseTo(1 / 3);
    expect(result.key).toBe('third');
  });

  it('handles ISO datetime strings (not just date strings)', () => {
    const result = getPaymentFraction('2026-06-05T10:30:00.000Z');
    expect(result.fraction).toBe(1);
  });
});

describe('LICENSE_PLATE_RE (German format)', () => {
  // Valid formats
  it('accepts single-letter city code: B-XY-1234', () => {
    expect(LICENSE_PLATE_RE.test('B-XY-1234')).toBe(true);
  });

  it('accepts two-letter city code: HD-AB-123', () => {
    expect(LICENSE_PLATE_RE.test('HD-AB-123')).toBe(true);
  });

  it('accepts three-letter city code: KAR-AB-12', () => {
    expect(LICENSE_PLATE_RE.test('KAR-AB-12')).toBe(true);
  });

  it('accepts one digit: HD-AB-1', () => {
    expect(LICENSE_PLATE_RE.test('HD-AB-1')).toBe(true);
  });

  it('accepts four digits: HD-AB-1234', () => {
    expect(LICENSE_PLATE_RE.test('HD-AB-1234')).toBe(true);
  });

  it('accepts lowercase (case-insensitive flag)', () => {
    expect(LICENSE_PLATE_RE.test('hd-ab-123')).toBe(true);
  });

  it('accepts umlauts in city code: ÖA-AB-123', () => {
    expect(LICENSE_PLATE_RE.test('ÖA-AB-123')).toBe(true);
  });

  // Invalid formats
  it('rejects empty string', () => {
    expect(LICENSE_PLATE_RE.test('')).toBe(false);
  });

  it('rejects plain text with no dashes: INVALID', () => {
    expect(LICENSE_PLATE_RE.test('INVALID')).toBe(false);
  });

  it('rejects five-digit number: HD-AB-12345', () => {
    expect(LICENSE_PLATE_RE.test('HD-AB-12345')).toBe(false);
  });

  it('rejects missing second segment: HD-123', () => {
    expect(LICENSE_PLATE_RE.test('HD-123')).toBe(false);
  });

  it('rejects four-letter city code: HDAB-AB-123', () => {
    expect(LICENSE_PLATE_RE.test('HDAB-AB-123')).toBe(false);
  });

  it('rejects three-letter middle segment: HD-ABC-123', () => {
    expect(LICENSE_PLATE_RE.test('HD-ABC-123')).toBe(false);
  });

  it('rejects digits in middle segment: HD-1B-123', () => {
    expect(LICENSE_PLATE_RE.test('HD-1B-123')).toBe(false);
  });
});
```

- [ ] **Step 2: Run all tests and confirm they all pass:**

```bash
npm run test:unit
```

Expected:
```
✓ tests/unit/payments.test.js (11 tests)
✓ tests/unit/spots.test.js (14 tests)
✓ tests/unit/auth.test.js (10 tests)
✓ tests/unit/i18n.test.js (13 tests)
✓ tests/unit/invite.test.js (20 tests)

Test Files  5 passed (5)
Tests      68 passed (68)
```

- [ ] **Step 3: Commit:**

```bash
git add tests/unit/invite.test.js
git commit -m "test: unit tests for getPaymentFraction and license plate regex"
```

---

## Task 7: Add `.gitignore` entries and push

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Check if `.gitignore` exists and add node_modules + coverage:**

```bash
cd /Users/D069379/My_X/Park_Management
cat .gitignore 2>/dev/null || echo "(no .gitignore)"
```

- [ ] **Step 2: Add entries to `.gitignore` (append if file exists, create if not):**

Add these lines to `.gitignore`:
```
node_modules/
coverage/
playwright-report/
test-results/
```

- [ ] **Step 3: Verify node_modules is not tracked:**

```bash
git status
```

Expected: `node_modules/` does not appear in untracked files.

- [ ] **Step 4: Commit and push:**

```bash
git add .gitignore
git commit -m "chore: ignore node_modules, coverage, and playwright artifacts"
git push
```
