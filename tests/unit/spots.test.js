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
    sortSpots(spots);
    expect(spots[0].label).toBe('2');
  });
});
