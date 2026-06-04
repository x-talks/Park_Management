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

// Send a request to the Cloudflare Worker (requires valid JWT)
async function workerRequest(method, path, body) {
  const token = _accessToken();
  const res = await fetch(CONFIG.workerUrl + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + (token || ''),
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || 'Request failed');
  }
  return res.json().catch(() => null);
}

async function _get(table, params) {
  let url = `${CONFIG.supabaseUrl}/rest/v1/${table}`;
  if (params) url += '?' + params;
  const res = await fetch(url, { headers: _headers() });
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
