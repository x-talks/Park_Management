// js/auth.js

async function login(username, password) {
  const { accessToken, refreshToken, user } = await workerRequest('POST', '/auth/login', {
    username: username.trim().toUpperCase(),
    password,
  });
  localStorage.setItem('pm_access_token', accessToken);
  if (refreshToken) localStorage.setItem('pm_refresh_token', refreshToken);
  localStorage.setItem('pm_user', JSON.stringify(user));
  scheduleRefresh(accessToken);
  return user;
}

function getSession() {
  const raw = localStorage.getItem('pm_user');
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
  workerRequest('POST', '/auth/logout').catch(() => {});
  _cancelRefreshTimer();
  localStorage.removeItem('pm_access_token');
  localStorage.removeItem('pm_refresh_token');
  localStorage.removeItem('pm_user');
  location.href = 'index.html';
}

function buildUserChip(containerId, user) {
  const el = document.getElementById(containerId);
  if (!el || !user) return;
  const label = user.role === 'renter'
    ? (user.licensePlate || user.username || '').toUpperCase()
    : (user.name || user.username || user.role).split(' ')[0];
  const initial = label.charAt(0).toUpperCase();
  const roleClass = user.role === 'master' ? 'chip-master' : user.role === 'admin' ? 'chip-admin' : 'chip-renter';

  el.innerHTML = '';
  el.className = 'user-chip ' + roleClass;
  const avatar = document.createElement('span');
  avatar.className = 'user-chip-avatar';
  avatar.textContent = initial;
  const name = document.createElement('span');
  name.className = 'user-chip-label';
  name.textContent = label;
  el.appendChild(avatar);
  el.appendChild(name);
}
