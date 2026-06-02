// js/i18n.js
// Central i18n system.
// Usage:
//   t('key')           — translate key, falls back to English
//   t('key', a, b)     — translate with {0},{1} substitution
//   setLang('de')      — switch language (saves to localStorage + user profile if logged in)
//   applyPage()        — call once on DOMContentLoaded to replace all data-i18n attrs

(function () {
  const SUPPORTED = ['en', 'de', 'tr'];
  const MAPS = { en: typeof LANG_EN !== 'undefined' ? LANG_EN : {}, de: typeof LANG_DE !== 'undefined' ? LANG_DE : {}, tr: typeof LANG_TR !== 'undefined' ? LANG_TR : {} };

  // ── Resolve current language ─────────────────────────────────────────────
  function getLang() {
    return localStorage.getItem('lang') || 'en';
  }

  // ── Core translate ───────────────────────────────────────────────────────
  // t('key')  or  t('key', arg0, arg1, …)
  function t(key /*, ...args */) {
    const lang = getLang();
    const dict = MAPS[lang] || MAPS.en;
    const en   = MAPS.en;
    let str = dict[key] !== undefined ? dict[key] : (en[key] !== undefined ? en[key] : key);
    // Substitute {0}, {1}, …
    for (let i = 1; i < arguments.length; i++) {
      str = str.replace(new RegExp('\\{' + (i - 1) + '\\}', 'g'), arguments[i]);
    }
    return str;
  }

  // ── Set language ─────────────────────────────────────────────────────────
  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem('lang', lang);
    // Persist to user profile in background (non-blocking)
    _syncLangToProfile(lang);
    applyPage();
    _updateSwitcher();
  }

  async function _syncLangToProfile(lang) {
    try {
      const session = typeof getSession === 'function' ? getSession() : null;
      if (!session) return;
      await patchRow('data/users.json', session.id, { language: lang });
    } catch (_) { /* silent — not critical */ }
  }

  // On login, call this to pull language from profile and apply it
  function applySavedLangFromProfile(user) {
    if (user && user.language && SUPPORTED.includes(user.language)) {
      localStorage.setItem('lang', user.language);
      applyPage();
      _updateSwitcher();
    }
  }

  // ── DOM application ──────────────────────────────────────────────────────
  // Elements with data-i18n="key"       → textContent replaced
  // Elements with data-i18n-ph="key"    → placeholder replaced
  // Elements with data-i18n-title="key" → title replaced
  // Elements with data-i18n-html="key"  → innerHTML replaced (use sparingly)
  function applyPage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    // Update <html lang="…">
    document.documentElement.lang = getLang();
  }

  // ── Language switcher widget ─────────────────────────────────────────────
  // Renders into any element with id="lang-switcher"
  function _updateSwitcher() {
    const sw = document.getElementById('lang-switcher');
    if (!sw) return;
    const cur = getLang();
    sw.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === cur);
    });
  }

  function buildSwitcher(containerId) {
    const sw = document.getElementById(containerId || 'lang-switcher');
    if (!sw) return;
    sw.innerHTML = '';
    sw.style.cssText = 'display:flex;gap:0.2rem;align-items:center';
    SUPPORTED.forEach(lang => {
      const btn = document.createElement('button');
      btn.dataset.lang = lang;
      btn.textContent = lang.toUpperCase();
      btn.className = 'secondary sm lang-btn';
      btn.style.cssText = 'min-width:2.2rem;padding:0.15rem 0.35rem;font-size:0.7rem;font-weight:700;letter-spacing:.03em';
      if (lang === getLang()) btn.classList.add('active');
      btn.addEventListener('click', () => setLang(lang));
      sw.appendChild(btn);
    });
  }

  // ── Expose globally ──────────────────────────────────────────────────────
  window.t                    = t;
  window.setLang              = setLang;
  window.applyPage            = applyPage;
  window.buildSwitcher        = buildSwitcher;
  window.applySavedLangFromProfile = applySavedLangFromProfile;
  window.getCurrentLang       = getLang;
})();
