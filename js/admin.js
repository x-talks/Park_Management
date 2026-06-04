// js/admin.js

// ── User management ──────────────────────────────────────────────────────────

async function loadUsers() {
  return readFile('data/users.json');
}

async function toggleUserActive(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error(typeof t === 'function' ? t('err.user.notfound') : 'User not found');
  if (user.role === 'master') throw new Error(typeof t === 'function' ? t('err.deactivate.master') : 'Cannot deactivate master admin');
  await workerRequest('PATCH', `/users/${userId}`, { active: !user.active });
}

async function setUserRole(userId, newRole, callerRole) {
  if (callerRole !== 'master') throw new Error(typeof t === 'function' ? t('err.role.master') : 'Only master can change roles');
  await workerRequest('POST', `/users/${userId}/role`, { role: newRole });
}

async function resetPassword(userId, newPassword, callerRole) {
  if (callerRole !== 'admin' && callerRole !== 'master') throw new Error(typeof t === 'function' ? t('err.pw.notauthorized') : 'Not authorized');
  await workerRequest('POST', `/users/${userId}/password`, { password: newPassword });
}

async function deleteUser(userId) {
  await workerRequest('DELETE', `/users/${userId}`);
}

async function updateUser(userId, changes) {
  await workerRequest('PATCH', `/users/${userId}`, changes);
}

async function approvePendingEdit(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !user.pendingEdits) throw new Error(typeof t === 'function' ? t('err.nopending') : 'No pending edits');
  const { requestedAt, ...changes } = user.pendingEdits;
  await workerRequest('PATCH', `/users/${userId}`, { ...changes, pendingEdits: null });
}

async function rejectPendingEdit(userId) {
  await workerRequest('PATCH', `/users/${userId}`, { pendingEdits: null });
}

async function setTerminationDate(userId, date) {
  await workerRequest('PATCH', `/users/${userId}`, { terminationDate: date || null });
}

// ── Spot assignment ───────────────────────────────────────────────────────────

async function assignSpot(spotId, userId) {
  const [spots, users] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json')
  ]);
  const spot = spots.find(s => s.id === spotId);
  const user = users.find(u => u.id === userId);
  if (!spot) throw new Error(typeof t === 'function' ? t('err.spot.notfound') : 'Spot not found');
  if (!user) throw new Error(typeof t === 'function' ? t('err.user.notfound') : 'User not found');
  if (spot.assignedUserId) throw new Error(typeof t === 'function' ? t('err.spot.assigned') : 'Spot already assigned');

  const assignedSpots = [...(user.assignedSpots || [])];
  if (!assignedSpots.includes(spotId)) assignedSpots.push(spotId);

  await Promise.all([
    workerRequest('PATCH', `/spots/${spotId}`, { assignedUserId: userId, state: 'occupied' }),
    workerRequest('PATCH', `/users/${userId}`, { assignedSpots }),
  ]);
}

async function unassignSpot(spotId) {
  const [spots, users] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json')
  ]);
  const spot = spots.find(s => s.id === spotId);
  if (!spot || !spot.assignedUserId) return;
  const user = users.find(u => u.id === spot.assignedUserId);

  const patches = [
    workerRequest('PATCH', `/spots/${spotId}`, { assignedUserId: null, state: 'free' }),
  ];
  if (user) {
    const assignedSpots = (user.assignedSpots || []).filter(id => id !== spotId);
    patches.push(workerRequest('PATCH', `/users/${user.id}`, { assignedSpots }));
  }
  await Promise.all(patches);
}

async function setSpotReserved(spotId, reserved) {
  if (reserved) {
    await workerRequest('PATCH', `/spots/${spotId}`, { reserved: true, state: 'reserved', assignedUserId: null });
  } else {
    await workerRequest('PATCH', `/spots/${spotId}`, { reserved: false, state: 'free' });
  }
}

async function setSpotRent(spotId, rent, fromMonth) {
  // fromMonth: 'YYYY-MM' string
  const spots = await readFile('data/spots.json');
  const spot = spots.find(s => s.id === spotId);
  if (!spot) throw new Error('Spot not found');
  const history = [...(spot.rentHistory || [])];
  // Remove existing entry for same month if present
  const idx = history.findIndex(h => h.from === fromMonth);
  if (idx >= 0) history[idx] = { from: fromMonth, rent };
  else history.push({ from: fromMonth, rent });
  history.sort((a, b) => a.from.localeCompare(b.from));
  await workerRequest('PATCH', `/spots/${spotId}`, { monthlyRent: rent, rentHistory: history });
}

// ── Payments ──────────────────────────────────────────────────────────────────

// Returns the effective monthly rent for a given spot and month/year.
function getRentForMonth(spot, year, month) {
  const history = spot.rentHistory;
  if (history && history.length > 0) {
    const key = `${year}-${String(month).padStart(2,'0')}`;
    const applicable = history
      .filter(h => h.from <= key)
      .sort((a, b) => b.from.localeCompare(a.from));
    if (applicable.length > 0) return applicable[0].rent;
  }
  return spot.monthlyRent || 80;
}

async function markPaid(spotId, userId, month, year, adminId, type) {
  type = type || 'rent';
  await workerRequest('POST', '/payments', { spotId, userId, month, year, type });
}

async function unmarkPaid(paymentId) {
  await workerRequest('DELETE', `/payments/${paymentId}`);
}

async function getPaymentMatrix() {
  const [payments, spots] = await Promise.all([
    readFile('data/payments.json'),
    readFile('data/spots.json')
  ]);
  return { payments, spots };
}

// ── Pending registrations ──────────────────────────────────────────────────────

async function loadPendingRegistrations() {
  return readFile('data/pending_registrations');
}

async function approvePendingRegistration(prId) {
  const result = await workerRequest('POST', `/pending-registrations/${prId}/approve`);
  return result; // { ok, userId, tempPassword }
}

async function rejectPendingRegistration(prId) {
  await workerRequest('DELETE', `/pending-registrations/${prId}`);
}

// ── Invite links ──────────────────────────────────────────────────────────────

async function createAndInviteUser({ name, lastName, phone, address, spotId, licensePlate, carModel, carColor }) {
  const result = await workerRequest('POST', '/invites', {
    name: name || '', lastName: lastName || '',
    phone: phone || '', address: address || '',
    spotId,
    licensePlate: licensePlate || null,
    carModel: carModel || null,
    carColor: carColor || null,
  });

  const base = location.origin + location.pathname.replace('admin.html', '');
  return `${base}register.html?token=${result.token}`;
}
