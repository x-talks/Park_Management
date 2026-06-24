// js/theme.js
// Theme cycling: Light Premium → Dark Glass → Dark Deep → (loop)

const THEMES = ['light', 'dark-glass', 'dark-deep'];
const ICONS  = { 'light': 'sun', 'dark-glass': 'sparkles', 'dark-deep': 'moon' };
const LABELS = { 'light': 'Light', 'dark-glass': 'Dark Glass', 'dark-deep': 'Dark Deep' };
const KEY = 'pm-theme';

export function initTheme() {
  const saved = localStorage.getItem(KEY) || 'light';
  _applyTheme(saved);
}

export function cycleTheme() {
  const current = document.documentElement.dataset.theme || 'light';
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  _applyTheme(next);
  localStorage.setItem(KEY, next);
}

function _applyTheme(theme) {
  if (theme === 'light') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) {
      icon.dataset.lucide = ICONS[theme];
      if (window.lucide) window.lucide.createIcons();
    }
    btn.title = LABELS[theme];
  }
}
