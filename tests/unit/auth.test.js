// tests/unit/auth.test.js
// Tests for session logic from js/auth.js.
// Uses jsdom localStorage (provided by vitest jsdom environment).

import { describe, it, expect, beforeEach } from 'vitest';

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

  it('throws when pm_user is malformed JSON', () => {
    localStorage.setItem('pm_user', 'NOT_JSON');
    expect(() => getSession()).toThrow();
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
