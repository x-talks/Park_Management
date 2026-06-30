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
  return sessionStorage.getItem('pm_access_token');
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

// Attempt to get a fresh access token using the stored refresh token.
// Returns true if successful, false if no refresh token or refresh failed.
async function _tryRefresh() {
  const refreshToken = sessionStorage.getItem('pm_refresh_token');
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
    sessionStorage.setItem('pm_access_token', data.access_token);
    if (data.refresh_token) sessionStorage.setItem('pm_refresh_token', data.refresh_token);
    return true;
  } catch (_) {
    return false;
  }
}

function _clearSession() {
  sessionStorage.removeItem('pm_access_token');
  sessionStorage.removeItem('pm_refresh_token');
  sessionStorage.removeItem('pm_user');
  location.href = 'index.html';
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

  // Token expired — try refresh once, then retry
  if (res.status === 401) {
    const refreshed = await _tryRefresh();
    if (!refreshed) { _clearSession(); throw new Error('Session expired'); }
    res = await _doRequest();
    if (res.status === 401) { _clearSession(); throw new Error('Session expired'); }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || 'Request failed');
  }
  return res.json().catch(() => null);
}

function _checkExpired(res) {
  // Supabase direct calls use the anon key so they don't expire the same way,
  // but guard anyway.
  if (res.status === 401) {
    _clearSession();
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
