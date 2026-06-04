// js/auth.js

async function login(username, password) {
  const { accessToken, refreshToken, user } = await workerRequest('POST', '/auth/login', {
    username: username.trim().toUpperCase(),
    password,
  });
  sessionStorage.setItem('pm_access_token', accessToken);
  if (refreshToken) sessionStorage.setItem('pm_refresh_token', refreshToken);
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
  workerRequest('POST', '/auth/logout').catch(() => {});
  sessionStorage.removeItem('pm_access_token');
  sessionStorage.removeItem('pm_refresh_token');
  sessionStorage.removeItem('pm_user');
  location.href = 'index.html';
}
