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
  await patchRow('data/users.json', userId, { active: !user.active });
}

async function setUserRole(userId, newRole, callerRole) {
  if (callerRole !== 'master') throw new Error(typeof t === 'function' ? t('err.role.master') : 'Only master can change roles');
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || user.role === 'master') throw new Error(typeof t === 'function' ? t('err.user.master') : 'Cannot modify master admin');
  await patchRow('data/users.json', userId, { role: newRole });
}

async function resetPassword(userId, newPassword, callerRole) {
  if (callerRole !== 'admin' && callerRole !== 'master') throw new Error(typeof t === 'function' ? t('err.pw.notauthorized') : 'Not authorized');
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || user.role === 'master') throw new Error(typeof t === 'function' ? t('err.pw.master') : 'Cannot reset master password here');
  const passwordHash = await hashPassword(newPassword);
  await patchRow('data/users.json', userId, { passwordHash, lastPassword: newPassword });
}

async function deleteUser(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error(typeof t === 'function' ? t('err.user.notfound') : 'User not found');
  if (user.role === 'master') throw new Error(typeof t === 'function' ? t('err.user.master') : 'Cannot modify master admin');
  for (const spotId of (user.assignedSpots || [])) {
    await unassignSpot(spotId);
  }
  await deleteRow('data/users.json', userId);
}

async function updateUser(userId, changes) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error(typeof t === 'function' ? t('err.user.notfound') : 'User not found');
  if (user.role === 'master') throw new Error(typeof t === 'function' ? t('err.user.master') : 'Cannot modify master admin');
  if (changes.licensePlate) {
    const plate = changes.licensePlate.toUpperCase().trim();
    const conflict = users.find(u => u.id !== userId && u.username === plate);
    if (conflict) throw new Error(typeof t === 'function' ? t('err.plate.taken') : 'License plate already in use');
    changes.licensePlate = plate;
    changes.username = plate;
  }
  await patchRow('data/users.json', userId, changes);
}

async function approvePendingEdit(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !user.pendingEdits) throw new Error(typeof t === 'function' ? t('err.nopending') : 'No pending edits');
  const { requestedAt, ...changes } = user.pendingEdits;
  await patchRow('data/users.json', userId, { ...changes, pendingEdits: null });
}

async function rejectPendingEdit(userId) {
  await patchRow('data/users.json', userId, { pendingEdits: null });
}

async function setTerminationDate(userId, date) {
  // date: 'YYYY-MM-DD' or null to clear
  await patchRow('data/users.json', userId, { terminationDate: date || null });
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
    patchRow('data/spots.json', spotId, { assignedUserId: userId, state: 'occupied' }),
    patchRow('data/users.json', userId, { assignedSpots })
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
    patchRow('data/spots.json', spotId, { assignedUserId: null, state: 'free' })
  ];
  if (user) {
    const assignedSpots = (user.assignedSpots || []).filter(id => id !== spotId);
    patches.push(patchRow('data/users.json', user.id, { assignedSpots }));
  }
  await Promise.all(patches);
}

async function setSpotReserved(spotId, reserved) {
  // reserved=true marks the spot grey (external owner, not available).
  // Clears any assigned user when reserving.
  if (reserved) {
    await patchRow('data/spots.json', spotId, { reserved: true, state: 'reserved', assignedUserId: null });
  } else {
    await patchRow('data/spots.json', spotId, { reserved: false, state: 'free' });
  }
}

// ── Payments ──────────────────────────────────────────────────────────────────

// Returns the effective monthly rent for a given spot and month/year.
// Uses rentHistory (array of {from: 'YYYY-MM', rent: number}) if present,
// falling back to monthlyRent for backwards compatibility.
function getRentForMonth(spot, year, month) {
  const history = spot.rentHistory;
  if (history && history.length > 0) {
    const key = `${year}-${String(month).padStart(2,'0')}`;
    // Find the last entry whose 'from' <= key
    const applicable = history
      .filter(h => h.from <= key)
      .sort((a, b) => b.from.localeCompare(a.from));
    if (applicable.length > 0) return applicable[0].rent;
  }
  return spot.monthlyRent || 80;
}

// type: 'commission' | 'rent'
async function markPaid(spotId, userId, month, year, adminId, type) {
  type = type || 'rent';
  const payments = await readFile('data/payments.json');
  const existing = payments.find(p =>
    p.spotId === spotId && p.month === month && p.year === year && p.type === type
  );
  if (existing) throw new Error(typeof t === 'function' ? t('err.pay.alreadypaid') : 'Already marked paid');
  const id = 'p' + Date.now() + '_' + type;
  await upsertRow('data/payments.json', {
    id, spotId, userId, month, year, type,
    paidDate: new Date().toISOString().slice(0, 10),
    markedByAdminId: adminId
  });
}

async function unmarkPaid(paymentId) {
  await deleteRow('data/payments.json', paymentId);
}

async function getPaymentMatrix() {
  const [payments, spots] = await Promise.all([
    readFile('data/payments.json'),
    readFile('data/spots.json')
  ]);
  return { payments, spots };
}

// ── Invite links ──────────────────────────────────────────────────────────────

async function createAndInviteUser({ name, lastName, phone, address, spotId, licensePlate, carModel, carColor }) {
  const spots = await readFile('data/spots.json');
  const spot = spots.find(s => s.id === spotId);
  if (!spot) throw new Error('Spot not found');
  if (spot.assignedUserId) throw new Error('Spot already assigned');

  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const id = 'inv' + Date.now();

  await upsertRow('data/invites.json', {
    id, token, spotId, expiresAt, usedBy: null,
    name: name || '', lastName: lastName || '',
    phone: phone || '', address: address || '',
    licensePlate: licensePlate || null,
    carModel: carModel || null,
    carColor: carColor || null
  });

  const base = location.origin + location.pathname.replace('admin.html', '');
  return `${base}register.html?token=${token}`;
}
