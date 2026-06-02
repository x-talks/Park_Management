// js/auth.js

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function login(username, password) {
  const hash = await hashPassword(password);
  const url = `${CONFIG.supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(username)}&passwordHash=eq.${encodeURIComponent(hash)}&active=eq.true&limit=1`;
  const res = await fetch(url, {
    headers: {
      'apikey': CONFIG.supabaseKey,
      'Authorization': 'Bearer ' + CONFIG.supabaseKey
    }
  });
  if (!res.ok) throw new Error(typeof t === 'function' ? t('login.error.failed') : 'Login failed');
  const rows = await res.json();
  if (!rows.length) throw new Error(typeof t === 'function' ? t('err.auth.invalid') : 'Invalid credentials or account inactive');
  const user = rows[0];
  sessionStorage.setItem('pm_user', JSON.stringify(user));
  return user;
}

function getSession() {
  const raw = sessionStorage.getItem('pm_user');
  return raw ? JSON.parse(raw) : null;
}

function requireAuth(minRole) {
  const order = { renter: 0, admin: 1, master: 2 };
  const user = getSession();
  if (!user || order[user.role] < order[minRole]) {
    location.href = 'index.html';
    return null;
  }
  return user;
}

function logout() {
  sessionStorage.removeItem('pm_user');
  location.href = 'index.html';
}
