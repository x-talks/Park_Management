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

  it('handles ISO datetime strings', () => {
    const result = getPaymentFraction('2026-06-05T10:30:00.000Z');
    expect(result.fraction).toBe(1);
  });
});

describe('LICENSE_PLATE_RE (German format)', () => {
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

  it('accepts lowercase input', () => {
    expect(LICENSE_PLATE_RE.test('hd-ab-123')).toBe(true);
  });

  it('accepts umlauts in city code: ÖA-AB-123', () => {
    expect(LICENSE_PLATE_RE.test('ÖA-AB-123')).toBe(true);
  });

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
