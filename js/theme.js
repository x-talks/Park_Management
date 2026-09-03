// js/theme.js
// Theme cycling: Light → Dark Glass → (loop). dark-deep removed.

const THEMES = ['light', 'dark-glass'];
const ICONS  = { 'light': 'sun', 'dark-glass': 'sparkles' };
const LABELS = { 'light': 'Light', 'dark-glass': 'Dark Glass' };
const KEY = 'pm-theme';

export function initTheme() {
  // Theme already applied by inline head script — just sync the button icon.
  const saved = localStorage.getItem(KEY) || 'light';
  // Migrate anyone stuck on dark-deep → dark-glass
  const theme = saved === 'dark-deep' ? 'dark-glass' : saved;
  if (theme !== saved) localStorage.setItem(KEY, theme);
  _applyTheme(theme);
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
      icon.dataset.lucide = ICONS[theme] || 'sun';
      if (window.lucide) window.lucide.createIcons();
    }
    btn.title = LABELS[theme] || 'Light';
  }
}
