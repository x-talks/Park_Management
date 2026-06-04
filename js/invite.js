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
  if (!res.ok) throw new Error(typeof t === 'function' ? t('err.invite.notfound') : 'Invite not found');
  const rows = await res.json();
  const invite = rows[0];
  if (!invite) throw new Error(typeof t === 'function' ? t('err.invite.invalid') : 'Invalid invite link');
  if (invite.usedBy) throw new Error(typeof t === 'function' ? t('err.invite.used') : 'This invite has already been used');
  if (new Date(invite.expiresAt) < new Date()) throw new Error(typeof t === 'function' ? t('err.invite.expired') : 'Invite link has expired');
  return invite;
}

// German license plate: 1-3 letters, dash, 1-2 letters, dash, 1-4 digits
const LICENSE_PLATE_RE = /^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}-\d{1,4}$/i;

// Calculate pro-rated payment fraction based on registration day of month
function getPaymentFraction(registeredAt) {
  const day = new Date(registeredAt).getDate();
  if (day <= 10) return { fraction: 1,   key: 'full',  label: 'Full month',  desc: typeof t === 'function' ? t('pay.fraction.full.desc')  : 'Registered in first 10 days — full monthly rent applies.' };
  if (day <= 20) return { fraction: 0.5, key: 'half',  label: '½ month',     desc: typeof t === 'function' ? t('pay.fraction.half.desc')  : 'Registered between day 11–20 — half monthly rent for first month.' };
  return             { fraction: 1/3, key: 'third', label: '⅓ month',     desc: typeof t === 'function' ? t('pay.fraction.third.desc') : 'Registered after day 20 — one third monthly rent for first month.' };
}

async function registerViaInvite({ token, password, licensePlate, carModel, carColor }) {
  const invite = await validateInvite(token);

  const finalLicensePlate = (invite.licensePlate || licensePlate || '').toUpperCase().trim();
  const finalCarModel     = (invite.carModel     || carModel     || '').trim();
  const finalCarColor     = (invite.carColor     || carColor     || '').trim();

  if (!finalLicensePlate) throw new Error(typeof t === 'function' ? t('err.plate.required') : 'License plate is required');
  if (!LICENSE_PLATE_RE.test(finalLicensePlate)) throw new Error(typeof t === 'function' ? t('err.plate.format') : 'Invalid German license plate format (e.g. HD-XY-123)');
  if (!finalCarModel)     throw new Error(typeof t === 'function' ? t('err.model.required') : 'Car model is required');
  if (!finalCarColor)     throw new Error(typeof t === 'function' ? t('err.color.required') : 'Car color is required');
  if (!password)          throw new Error(typeof t === 'function' ? t('err.password.required') : 'Password is required');

  // Submit to Worker — it validates invite, checks for duplicates, writes pending_registrations
  await workerRequest('POST', '/pending-registrations', {
    token,
    name:         invite.name     || '',
    lastName:     invite.lastName || '',
    phone:        invite.phone    || '',
    address:      invite.address  || '',
    licensePlate: finalLicensePlate,
    carModel:     finalCarModel,
    carColor:     finalCarColor,
    password,
  });

  return invite.spotId;
}
