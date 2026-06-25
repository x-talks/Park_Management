// js/toast.js
// Lightweight toast notification system.
//
// Usage:
//   toast('Saved!');
//   toast('Something went wrong', 'error');
//   toast('Please wait…', 'info', 0);   // 0 = stays until dismissed
//
// Types: 'success' | 'error' | 'warn' | 'info'

(function () {
  function _getContainer() {
    let c = document.getElementById('pm-toast-container');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'pm-toast-container';
    document.body.appendChild(c);
    return c;
  }

  window.toast = function (message, type = 'success', duration = 3500) {
    const container = _getContainer();
    const el = document.createElement('div');
    el.className = `pm-toast pm-toast-${type}`;

    const icons = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ' };
    el.innerHTML = `<span class="pm-toast-icon">${icons[type] || icons.info}</span><span class="pm-toast-msg">${message}</span>`;

    container.appendChild(el);

    // Trigger enter animation
    requestAnimationFrame(() => el.classList.add('visible'));

    function dismiss() {
      el.classList.remove('visible');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }

    if (duration > 0) setTimeout(dismiss, duration);

    // Click to dismiss early
    el.addEventListener('click', dismiss);
    return dismiss;
  };
})();
