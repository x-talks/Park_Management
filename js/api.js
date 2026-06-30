// js/api.js
// Supabase REST API wrapper.
// Exposes readFile(table) and writeFile/upsertRow/deleteRow helpers
// so that admin.js, invite.js, auth.js keep working with minimal changes.
//
// "readFile('data/users.json')"  → SELECT * FROM users
// "writeFile('data/users.json', arr)" → full replace via upsert + delete
//
// Table name mapping:
//   data/users.json    → users
//   data/spots.json    → spots
//   data/invites.json  → invites
//   data/payments.json → payments

function _table(path) {
  const map = {
    'data/users.json':            'users',
    'data/spots.json':            'spots',
    'data/invites.json':          'invites',
    'data/payments.json':         'payments',
    'data/incidents.json':        'incidents',
    'data/pending_registrations': 'pending_registrations'
  };
  const t = map[path];
  if (!t) throw new Error('Unknown table path: ' + path);
  return t;
}

function _accessToken() {
  return localStorage.getItem('pm_access_token');
}

function _headers() {
  const token = _accessToken();
  return {
    'apikey': CONFIG.supabaseKey,
    'Authorization': 'Bearer ' + (token || CONFIG.supabaseKey),
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

// ── Proactive refresh timer ───────────────────────────────────────────────────
let _refreshTimer = null;

function _cancelRefreshTimer() {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
}

function scheduleRefresh(accessToken) {
  _cancelRefreshTimer();
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const expiresAt = payload.exp * 1000; // ms
    const refreshAt = expiresAt - 60_000; // 60 s before expiry
    const delay = refreshAt - Date.now();
    if (delay <= 0) {
      // Already expired or about to — refresh immediately
      _tryRefresh().catch(() => {});
      return;
    }
    _refreshTimer = setTimeout(async () => {
      const ok = await _tryRefresh();
      if (!ok) {
        // Refresh token dead — show re-auth modal proactively
        _handleAuthFailure();
      }
    }, delay);
  } catch (_) {
    // Malformed token — ignore, reactive refresh will handle it
  }
}

// On page load: if a stored token exists, schedule refresh for it
(function _initRefreshOnLoad() {
  const token = localStorage.getItem('pm_access_token');
  if (token) scheduleRefresh(token);
})();

// Attempt to get a fresh access token using the stored refresh token.
// Returns true if successful, false if no refresh token or refresh failed.
async function _tryRefresh() {
  const refreshToken = localStorage.getItem('pm_refresh_token');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': CONFIG.supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.access_token) return false;
    localStorage.setItem('pm_access_token', data.access_token);
    if (data.refresh_token) localStorage.setItem('pm_refresh_token', data.refresh_token);
    scheduleRefresh(data.access_token);
    return true;
  } catch (_) {
    return false;
  }
}

function _clearSession() {
  _cancelRefreshTimer();
  localStorage.removeItem('pm_access_token');
  localStorage.removeItem('pm_refresh_token');
  localStorage.removeItem('pm_user');
}

// Re-auth modal: shown when the refresh token is dead and silent refresh failed.
// Returns a Promise that resolves after the user successfully re-authenticates.
// All pending workerRequest calls await this same promise (no stacked modals).
let _reauthPromise = null;

function _handleAuthFailure() {
  if (_reauthPromise) return _reauthPromise;

  // Capture username BEFORE clearing session
  let username = null;
  try {
    const raw = localStorage.getItem('pm_user');
    if (raw) {
      const u = JSON.parse(raw);
      username = u.licensePlate || u.username || null;
    }
  } catch (_) {}

  _clearSession();

  // Inject modal HTML once
  if (!document.getElementById('reauth-overlay')) {
    const _lang = localStorage.getItem('pm_lang') || 'en';
    const _ra = {
      en: { title: 'Session expired', body: 'Your session has expired. Please enter your password to continue.', label: 'Password', placeholder: 'Your password', btn: 'Sign in again' },
      de: { title: 'Sitzung abgelaufen', body: 'Deine Sitzung ist abgelaufen. Bitte gib dein Passwort ein, um fortzufahren.', label: 'Passwort', placeholder: 'Dein Passwort', btn: 'Erneut anmelden' },
      tr: { title: 'Oturum süresi doldu', body: 'Oturumunuz sona erdi. Devam etmek için şifrenizi girin.', label: 'Şifre', placeholder: 'Şifreniz', btn: 'Tekrar giriş yap' },
    }[_lang] || { title: 'Session expired', body: 'Your session has expired. Please enter your password to continue.', label: 'Password', placeholder: 'Your password', btn: 'Sign in again' };

    document.body.insertAdjacentHTML('beforeend', `
      <div id="reauth-overlay">
        <div id="reauth-card">
          <h2>${_ra.title}</h2>
          <p>${_ra.body}</p>
          <div class="form-group">
            <label>${_ra.label}</label>
            <input id="reauth-password" type="password" autocomplete="current-password" placeholder="${_ra.placeholder}"/>
          </div>
          <span id="reauth-error"></span>
          <button id="reauth-submit">${_ra.btn}</button>
        </div>
      </div>
    `);
  }

  const overlay   = document.getElementById('reauth-overlay');
  const pwInput   = document.getElementById('reauth-password');
  const errEl     = document.getElementById('reauth-error');
  const submitBtn = document.getElementById('reauth-submit');

  overlay.classList.add('active');
  pwInput.value = '';
  errEl.style.display = 'none';
  submitBtn.disabled = false;
  setTimeout(() => pwInput.focus(), 50);

  _reauthPromise = new Promise(resolve => {
    async function attempt() {
      const password = pwInput.value;
      if (!password) return;
      submitBtn.disabled = true;
      errEl.style.display = 'none';
      try {
        const res = await fetch(`${CONFIG.workerUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username ? username.trim().toUpperCase() : '', password }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Login failed');
        }
        const data = await res.json();
        localStorage.setItem('pm_access_token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('pm_refresh_token', data.refreshToken);
        localStorage.setItem('pm_user', JSON.stringify(data.user));
        scheduleRefresh(data.accessToken);
        overlay.classList.remove('active');
        _reauthPromise = null;
        resolve();
      } catch (e) {
        errEl.textContent = e.message || 'Incorrect password';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
      }
    }

    submitBtn.onclick = attempt;
    pwInput.onkeydown = e => { if (e.key === 'Enter') attempt(); };
  });

  return _reauthPromise;
}

// Send a request to the Cloudflare Worker (requires valid JWT)
async function workerRequest(method, path, body) {
  const _doRequest = () => fetch(CONFIG.workerUrl + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + (_accessToken() || ''),
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let res = await _doRequest();

  // Token expired — try silent refresh first, then re-auth modal as last resort
  if (res.status === 401) {
    const refreshed = await _tryRefresh();
    if (!refreshed) {
      await _handleAuthFailure();
      res = await _doRequest();
      if (res.status === 401) { _clearSession(); location.href = 'index.html'; throw new Error('Session expired'); }
    } else {
      res = await _doRequest();
      if (res.status === 401) {
        await _handleAuthFailure();
        res = await _doRequest();
        if (res.status === 401) { _clearSession(); location.href = 'index.html'; throw new Error('Session expired'); }
      }
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || 'Request failed');
  }
  return res.json().catch(() => null);
}

function _checkExpired(res) {
  if (res.status === 401) {
    _clearSession();
    location.href = 'index.html';
    throw new Error('Session expired');
  }
}

async function _get(table, params) {
  let url = `${CONFIG.supabaseUrl}/rest/v1/${table}`;
  if (params) url += '?' + params;
  const res = await fetch(url, { headers: { ..._headers(), 'Cache-Control': 'no-store' } });
  _checkExpired(res);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GET ${table}: ${res.status} ${err}`);
  }
  return res.json();
}

async function _upsert(table, rows) {
  const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ..._headers(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows)
  });
  _checkExpired(res);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`UPSERT ${table}: ${res.status} ${err}`);
  }
  return res.json();
}

async function _delete(table, column, value) {
  const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${table}?${column}=eq.${encodeURIComponent(value)}`, {
    method: 'DELETE',
    headers: _headers()
  });
  _checkExpired(res);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DELETE ${table}: ${res.status} ${err}`);
  }
}

async function _patch(table, filterCol, filterVal, changes) {
  const res = await fetch(
    `${CONFIG.supabaseUrl}/rest/v1/${table}?${filterCol}=eq.${encodeURIComponent(filterVal)}`,
    {
      method: 'PATCH',
      headers: _headers(),
      body: JSON.stringify(changes)
    }
  );
  _checkExpired(res);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PATCH ${table}: ${res.status} ${err}`);
  }
  return res.json();
}

// ── Public API ────────────────────────────────────────────────────────────────

// Read all rows from a table (returns array, compatible with old readFile)
async function readFile(path) {
  const table = _table(path);
  return _get(table, 'order=id');
}

// Full replace: upsert all rows in arr, delete any rows whose id is not in arr.
// This keeps the same semantics as the old GitHub writeFile (overwrite entire file).
async function writeFile(path, arr) {
  const table = _table(path);
  if (!arr || arr.length === 0) return;
  // Upsert all rows
  await _upsert(table, arr);
  // Delete rows no longer in the array
  const ids = arr.map(r => r.id).filter(Boolean);
  if (ids.length > 0) {
    // Delete rows where id NOT in the new set
    const inList = ids.map(id => `"${id}"`).join(',');
    const res = await fetch(
      `${CONFIG.supabaseUrl}/rest/v1/${table}?id=not.in.(${encodeURIComponent(ids.join(','))})`,
      { method: 'DELETE', headers: _headers() }
    );
    // Ignore 404 (nothing to delete)
    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`DELETE old rows ${table}: ${res.status} ${err}`);
    }
  }
}

// Convenience: upsert a single row (used by invite.js / admin.js for targeted updates)
async function upsertRow(path, row) {
  const table = _table(path);
  await _upsert(table, [row]);
}

// Convenience: delete a single row by id
async function deleteRow(path, id) {
  const table = _table(path);
  await _delete(table, 'id', id);
}

// Convenience: patch a single row by id
async function patchRow(path, id, changes) {
  const table = _table(path);
  await _patch(table, 'id', id, changes);
}

// ── Supabase Storage ──────────────────────────────────────────────────────────
// Bucket: 'incidents'

async function uploadIncidentImage(filePath, file) {
  // filePath e.g. "sA/2026-06-02T12-00-00_abc.jpg"
  const url = `${CONFIG.supabaseUrl}/storage/v1/object/incidents/${filePath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': CONFIG.supabaseKey,
      'Authorization': 'Bearer ' + CONFIG.supabaseKey,
      'Content-Type': file.type || 'image/jpeg',
      'x-upsert': 'true'
    },
    body: file
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage upload: ${res.status} ${err}`);
  }
  // Return the public URL
  return `${CONFIG.supabaseUrl}/storage/v1/object/public/incidents/${filePath}`;
}
