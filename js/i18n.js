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
    _updateAllSwitchers();
    // Let pages re-render dynamic content
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  async function _syncLangToProfile(lang) {
    try {
      const session = typeof getSession === 'function' ? getSession() : null;
      if (!session) return;
      await workerRequest('PATCH', `/users/${session.id}`, { language: lang });
    } catch (_) { /* silent — not critical */ }
  }

  // Called after login: only applies profile language if the user has never
  // explicitly set one in this browser (i.e. localStorage has no 'lang' key).
  // If the user already picked a language on the login page, that choice wins
  // and gets pushed to the profile instead.
  function applySavedLangFromProfile(user) {
    const hasLocalPref = localStorage.getItem('lang') !== null;
    if (hasLocalPref) {
      // User already has a local preference — push it to profile, don't overwrite
      _syncLangToProfile(getLang());
      return;
    }
    // No local preference yet — pull from profile
    if (user && user.language && SUPPORTED.includes(user.language)) {
      localStorage.setItem('lang', user.language);
      applyPage();
      _updateAllSwitchers();
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

  const LANG_LABELS = { en: '🇬🇧 EN', de: '🇩🇪 DE', tr: '🇹🇷 TR' };

  // ── Language switcher widget ─────────────────────────────────────────────
  function _updateAllSwitchers() {
    const cur = getLang();
    document.querySelectorAll('[data-lang-globe]').forEach(wrap => {
      const trigger = wrap.querySelector('.lang-globe-btn');
      if (trigger) trigger.textContent = '🌐 ' + cur.toUpperCase();
      wrap.querySelectorAll('button[data-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === cur);
      });
    });
  }

  function _closeAllDropdowns() {
    document.querySelectorAll('[data-lang-globe]').forEach(w => w.classList.remove('open'));
  }

  function buildSwitcher(containerId) {
    const sw = document.getElementById(containerId || 'lang-switcher');
    if (!sw) return;
    sw.setAttribute('data-lang-globe', '');
    sw.className = 'lang-globe-wrap';
    sw.innerHTML = '';

    const trigger = document.createElement('button');
    trigger.className = 'lang-globe-btn icon-btn';
    trigger.textContent = '🌐 ' + getLang().toUpperCase();
    trigger.setAttribute('aria-label', 'Switch language');
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = sw.classList.contains('open');
      _closeAllDropdowns();
      if (!isOpen) sw.classList.add('open');
    });

    const dropdown = document.createElement('div');
    dropdown.className = 'lang-globe-dropdown';
    SUPPORTED.forEach(lang => {
      const btn = document.createElement('button');
      btn.dataset.lang = lang;
      btn.textContent = LANG_LABELS[lang] || lang.toUpperCase();
      if (lang === getLang()) btn.classList.add('active');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        setLang(lang);
        _closeAllDropdowns();
      });
      dropdown.appendChild(btn);
    });

    sw.appendChild(trigger);
    sw.appendChild(dropdown);

    document.addEventListener('click', _closeAllDropdowns, { capture: false });
  }

  // ── Expose globally ──────────────────────────────────────────────────────
  window.t                    = t;
  window.setLang              = setLang;
  window.applyPage            = applyPage;
  window.buildSwitcher        = buildSwitcher;
  window.applySavedLangFromProfile = applySavedLangFromProfile;
  window.getCurrentLang       = getLang;
})();
