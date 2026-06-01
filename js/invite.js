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

async function registerViaInvite({ token, username, password, name, phone, address }) {
  const invite = await validateInvite(token);

  const users = await readFile('data/users.json');
  if (users.find(u => u.username === username)) throw new Error('Username already taken');
  const passwordHash = await hashPassword(password);
  const id = 'u' + Date.now();
  const newUser = {
    id, username, passwordHash, name, phone, address,
    role: 'renter', active: false,
    assignedSpots: []
  };
  users.push(newUser);
  await writeFile('data/users.json', users);

  // Mark invite as used
  const invites = await readFile('data/invites.json');
  const inv = invites.find(i => i.token === token);
  inv.usedBy = id;
  await writeFile('data/invites.json', invites);

  // Pre-assign spot (admin must activate account before renter can log in)
  await assignSpot(invite.spotId, id);

  return invite.spotId;
}
