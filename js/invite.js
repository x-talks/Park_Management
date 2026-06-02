// js/invite.js

function getTokenFromUrl() {
  return new URLSearchParams(location.search).get('token');
}

async function validateInvite(token) {
  const invites = await readFile('data/invites.json');
  const invite = invites.find(i => i.token === token);
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

  // Resolve final values: admin pre-fill takes priority, else user-provided
  const finalLicensePlate = (invite.licensePlate || licensePlate || '').toUpperCase().trim();
  const finalCarModel     = (invite.carModel     || carModel     || '').trim();
  const finalCarColor     = (invite.carColor     || carColor     || '').trim();

  if (!finalLicensePlate) throw new Error('License plate is required');
  if (!LICENSE_PLATE_RE.test(finalLicensePlate)) throw new Error('Invalid German license plate format (e.g. HD-XY-123)');
  if (!finalCarModel)     throw new Error('Car model is required');
  if (!finalCarColor)     throw new Error('Car color is required');
  if (!password)          throw new Error('Password is required');

  const users = await readFile('data/users.json');
  if (users.find(u => u.username === finalLicensePlate)) throw new Error('License plate already registered');

  const passwordHash = await hashPassword(password);
  const id = 'u' + Date.now();
  const newUser = {
    id,
    username:     finalLicensePlate,
    passwordHash,
    name:         invite.name     || '',
    lastName:     invite.lastName || '',
    phone:        invite.phone    || '',
    address:      invite.address  || '',
    licensePlate: finalLicensePlate,
    carModel:     finalCarModel,
    carColor:     finalCarColor,
    role:         'renter',
    active:       true,           // active immediately — invite is the authorization
    assignedSpots: [],
    pendingEdits: null
  };
  users.push(newUser);
  await writeFile('data/users.json', users);

  // Mark invite as used
  const invites = await readFile('data/invites.json');
  const inv = invites.find(i => i.token === token);
  inv.usedBy = id;
  await writeFile('data/invites.json', invites);

  // Assign spot
  await assignSpot(invite.spotId, id);

  return invite.spotId;
}
