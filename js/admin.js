// js/admin.js

// ── User management ──────────────────────────────────────────────────────────

async function loadUsers() {
  return readFile('data/users.json');
}

async function toggleUserActive(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  if (user.role === 'master') throw new Error('Cannot deactivate master admin');
  user.active = !user.active;
  await writeFile('data/users.json', users);
}

async function setUserRole(userId, newRole, callerRole) {
  if (callerRole !== 'master') throw new Error('Only master can change roles');
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || user.role === 'master') throw new Error('Cannot modify master admin');
  user.role = newRole;
  await writeFile('data/users.json', users);
}

async function resetPassword(userId, newPassword, callerRole) {
  if (callerRole !== 'admin' && callerRole !== 'master') throw new Error('Not authorized');
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || user.role === 'master') throw new Error('Cannot reset master password here');
  user.passwordHash = await hashPassword(newPassword);
  await writeFile('data/users.json', users);
}

async function approvePendingEdit(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !user.pendingEdits) throw new Error('No pending edits');
  const { requestedAt, ...changes } = user.pendingEdits;
  Object.assign(user, changes);
  user.pendingEdits = null;
  await writeFile('data/users.json', users);
}

async function rejectPendingEdit(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  user.pendingEdits = null;
  await writeFile('data/users.json', users);
}

// ── Spot assignment ───────────────────────────────────────────────────────────

async function assignSpot(spotId, userId) {
  const [spots, users] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json')
  ]);
  const spot = spots.find(s => s.id === spotId);
  const user = users.find(u => u.id === userId);
  if (!spot) throw new Error('Spot not found');
  if (!user) throw new Error('User not found');
  if (spot.assignedUserId) throw new Error('Spot already assigned');

  spot.assignedUserId = userId;
  spot.state = 'occupied';
  if (!user.assignedSpots.includes(spotId)) user.assignedSpots.push(spotId);

  await writeFile('data/spots.json', spots);
  await writeFile('data/users.json', users);
}

async function unassignSpot(spotId) {
  const [spots, users] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json')
  ]);
  const spot = spots.find(s => s.id === spotId);
  if (!spot || !spot.assignedUserId) return;
  const user = users.find(u => u.id === spot.assignedUserId);
  if (user) user.assignedSpots = user.assignedSpots.filter(id => id !== spotId);
  spot.assignedUserId = null;
  spot.state = 'free';

  await writeFile('data/spots.json', spots);
  await writeFile('data/users.json', users);
}

// ── Payments ──────────────────────────────────────────────────────────────────

async function markPaid(spotId, userId, month, year, adminId) {
  const payments = await readFile('data/payments.json');
  const existing = payments.find(p => p.spotId === spotId && p.month === month && p.year === year);
  if (existing) throw new Error('Already marked paid');
  const id = 'p' + Date.now();
  payments.push({ id, spotId, userId, month, year, paidDate: new Date().toISOString().slice(0, 10), markedByAdminId: adminId });
  await writeFile('data/payments.json', payments);
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

  const invites = await readFile('data/invites.json');
  invites.push({
    token, spotId, expiresAt, usedBy: null,
    name: name || '',
    lastName: lastName || '',
    phone: phone || '',
    address: address || '',
    licensePlate: licensePlate || null,
    carModel: carModel || null,
    carColor: carColor || null
  });
  await writeFile('data/invites.json', invites);

  const base = location.origin + location.pathname.replace('admin.html', '');
  return `${base}register.html?token=${token}`;
}
