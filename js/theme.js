// js/theme.js — Light / Dark-Glass theme management

const THEMES = ['light', 'dark-glass'];
const LABELS = { 'light': 'Light', 'dark-glass': 'Dark Glass' };
const KEY = 'pm-theme';

export function initTheme() {
  const saved = localStorage.getItem(KEY) || 'light';
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

// Build a pill toggle: [Light] [Dark Glass]
// Inserts into the element with id=containerId.
export function buildThemePill(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.className = 'theme-pill';

  THEMES.forEach(theme => {
    const btn = document.createElement('button');
    btn.className = 'theme-pill-btn';
    btn.textContent = LABELS[theme];
    btn.dataset.theme = theme;
    const cur = document.documentElement.dataset.theme || 'light';
    if (theme === cur) btn.classList.add('active');
    btn.title = LABELS[theme];
    btn.addEventListener('click', () => {
      _applyTheme(theme);
      localStorage.setItem(KEY, theme);
      wrap.querySelectorAll('.theme-pill-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.theme === theme)
      );
    });
    wrap.appendChild(btn);
  });
}

function _applyTheme(theme) {
  if (theme === 'light') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  // Sync any pill toggles on the page
  document.querySelectorAll('.theme-pill-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.theme === (theme === 'light' ? 'light' : theme))
  );
  // Legacy single icon toggle (login page)
  const btn = document.getElementById('theme-toggle');
  if (btn && !btn.closest('.hamburger-menu')) {
    btn.title = LABELS[theme] || 'Light';
  }
}
