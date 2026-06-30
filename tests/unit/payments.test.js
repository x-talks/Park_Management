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
        { from: '2026-07', rent: 110 },
      ],
    };
    expect(getRentForMonth(spot, 2026, 6)).toBe(95);
  });

  it('ignores history entries after the requested month', () => {
    const spot = {
      monthlyRent: 80,
      rentHistory: [{ from: '2026-07', rent: 110 }],
    };
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
