// js/modal.js
// Async modal dialogs replacing native alert()/confirm()/prompt().
//
// Usage:
//   await modalAlert('Something happened');
//   const ok = await modalConfirm('Delete this?', { danger: true });
//   const val = await modalPrompt('Enter new password:', { defaultValue: '' });

(function () {
  let _resolve = null;

  function _getOrCreate() {
    let overlay = document.getElementById('pm-modal-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'pm-modal-overlay';

    const modal = document.createElement('div');
    modal.id = 'pm-modal';

    const title = document.createElement('p');
    title.id = 'pm-modal-title';

    const body = document.createElement('p');
    body.id = 'pm-modal-body';

    const input = document.createElement('input');
    input.id = 'pm-modal-input';
    input.type = 'text';

    const footer = document.createElement('div');
    footer.id = 'pm-modal-footer';

    modal.appendChild(title);
    modal.appendChild(body);
    modal.appendChild(input);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Backdrop click → cancel
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _dismiss(false);
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); _dismiss(false); }
      if (e.key === 'Enter') {
        const confirm = document.getElementById('pm-modal-confirm');
        if (confirm && !confirm.disabled) { e.preventDefault(); _dismiss(true); }
      }
    });

    return overlay;
  }

  function _dismiss(confirmed) {
    const overlay = document.getElementById('pm-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    const input = document.getElementById('pm-modal-input');
    if (_resolve) {
      const inputVisible = input && input.classList.contains('visible');
      if (inputVisible) {
        _resolve(confirmed ? input.value : null);
      } else {
        _resolve(confirmed);
      }
      _resolve = null;
    }
  }

  function _open({ title, body, confirmLabel, confirmClass, cancelLabel, withInput, defaultValue, placeholder }) {
    const overlay = _getOrCreate();
    const titleEl  = document.getElementById('pm-modal-title');
    const bodyEl   = document.getElementById('pm-modal-body');
    const inputEl  = document.getElementById('pm-modal-input');
    const footerEl = document.getElementById('pm-modal-footer');

    titleEl.textContent = title || '';
    titleEl.style.display = title ? '' : 'none';
    bodyEl.textContent = body || '';

    inputEl.classList.toggle('visible', !!withInput);
    if (withInput) {
      inputEl.value = defaultValue || '';
      inputEl.placeholder = placeholder || '';
    }

    footerEl.innerHTML = '';

    if (cancelLabel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'secondary';
      cancelBtn.textContent = cancelLabel;
      cancelBtn.addEventListener('click', () => _dismiss(false));
      footerEl.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'pm-modal-confirm';
    confirmBtn.className = confirmClass || '';
    confirmBtn.textContent = confirmLabel || 'OK';
    confirmBtn.addEventListener('click', () => _dismiss(true));
    footerEl.appendChild(confirmBtn);

    overlay.classList.add('open');

    // Focus: input if present, else confirm button
    setTimeout(() => {
      if (withInput) inputEl.focus();
      else confirmBtn.focus();
    }, 50);

    return new Promise(res => { _resolve = res; });
  }

  window.modalAlert = function (message, opts = {}) {
    return _open({
      title: opts.title || null,
      body: message,
      confirmLabel: opts.confirmLabel || 'OK',
      confirmClass: '',
      cancelLabel: null,
    });
  };

  window.modalConfirm = function (message, opts = {}) {
    return _open({
      title: opts.title || null,
      body: message,
      confirmLabel: opts.confirmLabel || 'Confirm',
      confirmClass: opts.danger ? 'danger' : 'accent',
      cancelLabel: opts.cancelLabel || 'Cancel',
    });
  };

  window.modalPrompt = function (message, opts = {}) {
    return _open({
      title: opts.title || null,
      body: message,
      confirmLabel: opts.confirmLabel || 'OK',
      confirmClass: 'accent',
      cancelLabel: opts.cancelLabel || 'Cancel',
      withInput: true,
      defaultValue: opts.defaultValue || '',
      placeholder: opts.placeholder || '',
    });
  };
})();
