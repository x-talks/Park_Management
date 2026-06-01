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
  const users = await readFile('data/users.json');
  const hash = await hashPassword(password);
  const user = users.find(u => u.username === username && u.passwordHash === hash && u.active);
  if (!user) throw new Error('Invalid credentials or account inactive');
  sessionStorage.setItem('pm_user', JSON.stringify(user));
  return user;
}

function getSession() {
  const raw = sessionStorage.getItem('pm_user');
  return raw ? JSON.parse(raw) : null;
}

function requireAuth(minRole) {
  // minRole: 'renter' | 'admin' | 'master'
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
