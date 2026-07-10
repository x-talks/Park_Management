// tests/fixtures/seed.js
// Seeds the staging Supabase database with known test data.
// Run before E2E tests: node tests/fixtures/seed.js
// Requires: STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_KEY env vars.

import { createClient } from '@supabase/supabase-js';

const url    = process.env.STAGING_SUPABASE_URL;
const key    = process.env.STAGING_SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Missing required env vars: STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });

// ── Date helpers ──────────────────────────────────────────────────────────────

const now = new Date();
const year  = now.getFullYear();
const month = now.getMonth() + 1;

function firstOfMonth() {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function lastOfMonth() {
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${last}`;
}

function prevMonthYear() {
  const d = new Date(year, month - 2, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

// ── Create a Supabase Auth user and return authId ─────────────────────────────

async function createAuthUser(plate, password, role) {
  const email = plate.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@park.local';
  // Delete if already exists (idempotent)
  const { data: existing } = await supa.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === email);
  if (found) {
    await supa.auth.admin.deleteUser(found.id);
  }
  const { data, error } = await supa.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  if (error) throw new Error(`createAuthUser ${plate}: ${error.message}`);
  return data.user.id;
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  const adminPassword  = process.env.STAGING_ADMIN_PASSWORD;
  const masterPassword = process.env.STAGING_MASTER_PASSWORD;
  if (!adminPassword || !masterPassword) {
    throw new Error('Missing STAGING_ADMIN_PASSWORD or STAGING_MASTER_PASSWORD');
  }

  console.log('Seeding staging database...');

  // Create Auth users
  const masterAuthId = await createAuthUser('TEST-MASTER', masterPassword, 'master');
  const adminAuthId  = await createAuthUser('TEST-ADMIN',  adminPassword,  'admin');
  const renterAAuthId = await createAuthUser('HD-AA-001', 'TestPass123!', 'renter');
  const renterBAuthId = await createAuthUser('HD-BB-002', 'TestPass123!', 'renter');
  const renterCAuthId = await createAuthUser('HD-CC-003', 'TestPass123!', 'renter');

  // Spots: s1–s22, sA, sB
  const spotLabels = [
    ...Array.from({ length: 22 }, (_, i) => String(i + 1)),
    'A', 'B'
  ];
  const spots = spotLabels.map(label => {
    const id = label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
    const base = { id, label, reserved: false, owned: false, monthlyRent: 80, state: 'free', assignedUserId: null };
    if (id === 's1')  return { ...base, state: 'occupied', assignedUserId: 'u-renter-a' };
    if (id === 's2')  return { ...base, state: 'occupied', assignedUserId: 'u-renter-b' };
    if (id === 's3')  return { ...base, reserved: true };
    if (id === 's6')  return { ...base, state: 'occupied', assignedUserId: 'u-renter-c' };
    if (id === 'sA')  return { ...base, owned: true };
    return base;
  });

  const { error: spotsErr } = await supa.from('spots').upsert(spots);
  if (spotsErr) throw new Error(`spots upsert: ${spotsErr.message}`);
  console.log('  ✓ spots');

  // Users
  const pm = prevMonthYear();
  const users = [
    {
      id: 'u-master', username: 'TEST-MASTER', authId: masterAuthId,
      name: 'Test', lastName: 'Master', role: 'master', active: true,
      licensePlate: null, phone: null, carModel: null, carColor: null,
      address: null, assignedSpots: [], pendingEdits: null,
      registeredAt: '2024-01-01', terminationDate: null, passwordHash: null, lastPassword: null,
    },
    {
      id: 'u-admin', username: 'TEST-ADMIN', authId: adminAuthId,
      name: 'Test', lastName: 'Admin', role: 'admin', active: true,
      licensePlate: null, phone: null, carModel: null, carColor: null,
      address: null, assignedSpots: [], pendingEdits: null,
      registeredAt: '2024-01-01', terminationDate: null, passwordHash: null, lastPassword: null,
    },
    {
      id: 'u-renter-a', username: 'HD-AA-001', authId: renterAAuthId,
      name: 'Alice', lastName: 'Renter', role: 'renter', active: true,
      licensePlate: 'HD-AA-001', phone: '+49-123-001', carModel: 'VW Golf', carColor: 'red',
      address: 'Teststr. 1', assignedSpots: ['s1'], pendingEdits: null,
      registeredAt: firstOfMonth(), terminationDate: null, passwordHash: null, lastPassword: null,
    },
    {
      id: 'u-renter-b', username: 'HD-BB-002', authId: renterBAuthId,
      name: 'Bob', lastName: 'Renter', role: 'renter', active: true,
      licensePlate: 'HD-BB-002', phone: '+49-123-002', carModel: 'BMW 3', carColor: 'blue',
      address: 'Teststr. 2', assignedSpots: ['s2'], pendingEdits: null,
      registeredAt: `${pm.year}-${String(pm.month).padStart(2,'0')}-15`,
      terminationDate: lastOfMonth(), passwordHash: null, lastPassword: null,
    },
    {
      id: 'u-renter-c', username: 'HD-CC-003', authId: renterCAuthId,
      name: 'Carol', lastName: 'Renter', role: 'renter', active: false,
      licensePlate: 'HD-CC-003', phone: '+49-123-003', carModel: 'Audi A3', carColor: 'black',
      address: 'Teststr. 3', assignedSpots: JSON.stringify(['s6']), pendingEdits: null,
      registeredAt: '2025-01-01', terminationDate: null, passwordHash: null, lastPassword: null,
    },
  ];
  const { error: usersErr } = await supa.from('users').upsert(users);
  if (usersErr) throw new Error(`users upsert: ${usersErr.message}`);
  console.log('  ✓ users');

  // Payments
  const { year: pmYear, month: pmMonth } = prevMonthYear();
  const payments = [
    {
      id: 'pay-s1-commission', spotId: 's1', userId: 'u-renter-a',
      month: 1, year, type: 'commission',
      paidDate: firstOfMonth(), markedByAdminId: 'u-admin',
    },
    {
      id: 'pay-s1-current', spotId: 's1', userId: 'u-renter-a',
      month, year, type: 'rent',
      paidDate: firstOfMonth(), markedByAdminId: 'u-admin',
    },
    {
      id: 'pay-s2-prev', spotId: 's2', userId: 'u-renter-b',
      month: pmMonth, year: pmYear, type: 'rent',
      paidDate: `${pmYear}-${String(pmMonth).padStart(2,'0')}-01`, markedByAdminId: 'u-admin',
    },
  ];
  const { error: payErr } = await supa.from('payments').upsert(payments);
  if (payErr) throw new Error(`payments upsert: ${payErr.message}`);
  console.log('  ✓ payments');

  // Invites
  const validExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const expiredExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const usedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invites = [
    {
      id: 'inv-valid', token: 'VALID-TOKEN-FOR-E2E',
      spotId: 's4', expiresAt: validExpiry, usedBy: null,
      name: 'Dave', lastName: 'Invited', phone: '+49-000-004', address: 'Teststr. 4',
      licensePlate: null, carModel: null, carColor: null,
    },
    {
      id: 'inv-expired', token: 'EXPIRED-TOKEN-FOR-E2E',
      spotId: 's5', expiresAt: expiredExpiry, usedBy: null,
      name: 'Eve', lastName: 'Expired', phone: '+49-000-005', address: 'Teststr. 5',
      licensePlate: null, carModel: null, carColor: null,
    },
    {
      id: 'inv-used', token: 'USED-TOKEN-FOR-E2E',
      spotId: 's7', expiresAt: usedExpiry, usedBy: 'u-renter-a',
      name: 'Fred', lastName: 'Used', phone: '+49-000-007', address: 'Teststr. 7',
      licensePlate: null, carModel: null, carColor: null,
    },
    {
      id: 'inv-valid-s7', token: 'valid-token-s7',
      spotId: 's7', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), usedBy: null,
      name: 'David', lastName: 'Prospect', phone: '+49300000007', address: 'Test Street 7',
      licensePlate: 'HD-GG-007', carModel: 'Audi A4', carColor: 'silver',
    },
  ];
  const { error: invErr } = await supa.from('invites').upsert(invites);
  if (invErr) throw new Error(`invites upsert: ${invErr.message}`);
  console.log('  ✓ invites');

  // Pending registration for spot s6
  const { error: prErr } = await supa.from('pending_registrations').upsert([
    {
      id: 'pr-001', token: 'VALID-TOKEN-FOR-E2E',
      spotId: 's6', name: 'Dave', lastName: 'Pending',
      phone: '+49-000-006', address: 'Teststr. 6',
      licensePlate: 'HD-DD-004', carModel: 'Toyota Yaris', carColor: 'white',
      passwordHash: 'TestPass123!',
      submittedAt: new Date().toISOString(),
    },
  ]);
  if (prErr) throw new Error(`pending_registrations upsert: ${prErr.message}`);
  console.log('  ✓ pending_registrations');

  console.log('Seed complete.');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
