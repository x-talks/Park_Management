// js/invite.js

function getTokenFromUrl() {
  return new URLSearchParams(location.search).get('token');
}

async function validateInvite(token) {
  const url = `${CONFIG.supabaseUrl}/rest/v1/invites?token=eq.${encodeURIComponent(token)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      'apikey': CONFIG.supabaseKey,
      'Authorization': 'Bearer ' + CONFIG.supabaseKey
    }
  });
  if (!res.ok) throw new Error('Failed to load invite');
  const rows = await res.json();
  const invite = rows[0];
  if (!invite) throw new Error('Invalid invite link');
  if (invite.usedBy) throw new Error('This invite has already been used');
  if (new Date(invite.expiresAt) < new Date()) throw new Error('Invite link has expired');
  return invite;
}

// German license plate: 1-3 letters, dash, 1-2 letters, dash, 1-4 digits
const LICENSE_PLATE_RE = /^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}-\d{1,4}$/i;

// Calculate pro-rated payment fraction based on registration day of month
function getPaymentFraction(registeredAt) {
  const day = new Date(registeredAt).getDate();
  if (day <= 10) return { fraction: 1,   label: 'Full month', desc: 'Registered in first 10 days — full monthly rent applies.' };
  if (day <= 20) return { fraction: 0.5, label: '½ month',    desc: 'Registered between day 11–20 — half monthly rent for first month.' };
  return             { fraction: 1/3, label: '⅓ month',    desc: 'Registered after day 20 — one third monthly rent for first month.' };
}

async function registerViaInvite({ token, password, licensePlate, carModel, carColor }) {
  const invite = await validateInvite(token);

  const finalLicensePlate = (invite.licensePlate || licensePlate || '').toUpperCase().trim();
  const finalCarModel     = (invite.carModel     || carModel     || '').trim();
  const finalCarColor     = (invite.carColor     || carColor     || '').trim();

  if (!finalLicensePlate) throw new Error('License plate is required');
  if (!LICENSE_PLATE_RE.test(finalLicensePlate)) throw new Error('Invalid German license plate format (e.g. HD-XY-123)');
  if (!finalCarModel)     throw new Error('Car model is required');
  if (!finalCarColor)     throw new Error('Car color is required');
  if (!password)          throw new Error('Password is required');

  // Check license plate not already taken
  const checkRes = await fetch(
    `${CONFIG.supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(finalLicensePlate)}&limit=1`,
    { headers: { 'apikey': CONFIG.supabaseKey, 'Authorization': 'Bearer ' + CONFIG.supabaseKey } }
  );
  const existing = await checkRes.json();
  if (existing.length) throw new Error('License plate already registered');

  // Check spot is still free
  const spotRes = await fetch(
    `${CONFIG.supabaseUrl}/rest/v1/spots?id=eq.${encodeURIComponent(invite.spotId)}&limit=1`,
    { headers: { 'apikey': CONFIG.supabaseKey, 'Authorization': 'Bearer ' + CONFIG.supabaseKey } }
  );
  const spotRows = await spotRes.json();
  if (!spotRows.length) throw new Error('Spot not found');
  if (spotRows[0].assignedUserId) throw new Error('Spot already assigned');

  const passwordHash = await hashPassword(password);
  const id = 'u' + Date.now();
  const registeredAt = new Date().toISOString();

  // Create user
  await upsertRow('data/users.json', {
    id,
    username:      finalLicensePlate,
    passwordHash,
    lastPassword:  password,
    name:          invite.name     || '',
    lastName:      invite.lastName || '',
    phone:         invite.phone    || '',
    address:       invite.address  || '',
    licensePlate:  finalLicensePlate,
    carModel:      finalCarModel,
    carColor:      finalCarColor,
    role:          'renter',
    active:        true,
    assignedSpots: [invite.spotId],
    pendingEdits:  null,
    registeredAt
  });

  // Assign spot
  await patchRow('data/spots.json', invite.spotId, {
    assignedUserId: id,
    state: 'occupied'
  });

  // Mark invite as used
  await patchRow('data/invites.json', invite.id, { usedBy: id });

  return invite.spotId;
}
