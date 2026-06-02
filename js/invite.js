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
// e.g. HD-XY-123, M-AB-1234, KA-A-1
const LICENSE_PLATE_RE = /^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}-\d{1,4}$/i;

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
  const checkUrl = `${CONFIG.supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(finalLicensePlate)}&limit=1`;
  const checkRes = await fetch(checkUrl, {
    headers: { 'apikey': CONFIG.supabaseKey, 'Authorization': 'Bearer ' + CONFIG.supabaseKey }
  });
  const existing = await checkRes.json();
  if (existing.length) throw new Error('License plate already registered');

  // Check spot is still free
  const spotUrl = `${CONFIG.supabaseUrl}/rest/v1/spots?id=eq.${encodeURIComponent(invite.spotId)}&limit=1`;
  const spotRes = await fetch(spotUrl, {
    headers: { 'apikey': CONFIG.supabaseKey, 'Authorization': 'Bearer ' + CONFIG.supabaseKey }
  });
  const spotRows = await spotRes.json();
  if (!spotRows.length) throw new Error('Spot not found');
  const spot = spotRows[0];
  if (spot.assignedUserId) throw new Error('Spot already assigned');

  const passwordHash = await hashPassword(password);
  const id = 'u' + Date.now();

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
    pendingEdits:  null
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
