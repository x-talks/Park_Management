// tests/unit/i18n.test.js
// Tests for translation functions from js/i18n.js.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();

function loadI18n() {
  const combined = [
    readFileSync(resolve(root, 'js/i18n/en.js'), 'utf8'),
    readFileSync(resolve(root, 'js/i18n/de.js'), 'utf8'),
    readFileSync(resolve(root, 'js/i18n/tr.js'), 'utf8'),
    readFileSync(resolve(root, 'js/i18n.js'), 'utf8'),
  ].join('\n');
  eval(combined);
}

beforeEach(() => {
  localStorage.clear();
  loadI18n();
});

describe('t()', () => {
  it('returns the English translation for a known key', () => {
    expect(window.t('login.btn')).toBe('Sign In');
  });

  it('returns the key itself when the key is not found', () => {
    expect(window.t('nonexistent.key.xyz')).toBe('nonexistent.key.xyz');
  });

  it('substitutes {0} and {1} placeholders', () => {
    expect(window.t('admin.confirm.revert.rent', 'Jun', '2026')).toBe('Revert rent for Jun 2026?');
  });

  it('returns German translation when lang is set to de', () => {
    localStorage.setItem('lang', 'de');
    loadI18n();
    expect(window.t('login.btn')).toBe('Anmelden');
  });

  it('falls back to English string for a key missing in active language', () => {
    localStorage.setItem('lang', 'de');
    loadI18n();
    const result = window.t('login.btn');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getCurrentLang / setLang', () => {
  it('returns "en" by default', () => {
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
    window.setLang('fr');
    expect(localStorage.getItem('lang')).toBeNull();
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

  it('uses key as fallback for unknown keys', () => {
    document.body.innerHTML = '<span data-i18n="unknown.key.abc">old</span>';
    window.applyPage();
    expect(document.querySelector('[data-i18n]').textContent).toBe('unknown.key.abc');
  });
});
