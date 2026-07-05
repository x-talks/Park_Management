// worker/park-management-api/src/index.js
// Park Management API — Cloudflare Worker
// All writes to Supabase go through here using the service role key.
// Reads still go directly from browser to Supabase (anon key + RLS).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

// Verify Supabase JWT and return payload
async function verifyJWT(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const token = auth.slice(7);

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const b64 = s => s.replace(/-/g, '+').replace(/_/g, '/');
  const header  = JSON.parse(atob(b64(parts[0])));
  const payload = JSON.parse(atob(b64(parts[1])));

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  const sigInput = parts[0] + '.' + parts[1];
  const sigBytes = Uint8Array.from(atob(b64(parts[2])), c => c.charCodeAt(0));

  let valid = false;
  if (header.alg === 'ES256' && env.SUPABASE_JWT_JWKS) {
    // ECC P-256 verification using JWKS
    const jwks = JSON.parse(env.SUPABASE_JWT_JWKS);
    const jwk  = jwks.keys.find(k => k.kid === header.kid) || jwks.keys[0];
    const key  = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );
    valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, key, sigBytes,
      new TextEncoder().encode(sigInput)
    );
  } else {
    // HS256 verification using shared secret
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    valid = await crypto.subtle.verify(
      'HMAC', key, sigBytes, new TextEncoder().encode(sigInput)
    );
  }

  if (!valid) throw new Error('Invalid token signature');
  return payload;
}

function getRole(payload) {
  return payload?.app_metadata?.role || payload?.role || 'renter';
}

function requireRole(payload, minRole) {
  const order = { renter: 0, admin: 1, master: 2 };
  const role = getRole(payload);
  if ((order[role] ?? -1) < order[minRole]) throw new Error('Forbidden');
}

// Supabase service role client
function sb(env) {
  const base = env.SUPABASE_URL;
  const key  = env.SUPABASE_SERVICE_KEY;
  const headers = {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  return {
    async get(table, params = '') {
      const url = `${base}/rest/v1/${table}${params ? '?' + params : ''}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async post(table, body, prefer = 'resolution=merge-duplicates,return=representation') {
      const res = await fetch(`${base}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': prefer },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async patch(table, filter, body) {
      const res = await fetch(`${base}/rest/v1/${table}?${filter}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async delete(table, filter) {
      const res = await fetch(`${base}/rest/v1/${table}?${filter}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
    },
    // Supabase Auth Admin API
    async authAdmin(method, path, body) {
      const res = await fetch(`${base}/auth/v1/admin/${path}`, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    // Supabase Auth sign-in (uses anon key)
    async signIn(email, password) {
      const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error_description || e.message || 'Login failed');
      }
      return res.json();
    },
  };
}

// Convert license plate to Supabase Auth email
function plateToEmail(plate) {
  return plate.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@park.local';
}

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // ── Auth ────────────────────────────────────────────────────────────────

      // POST /auth/login  { username, password }
      if (method === 'POST' && path === '/auth/login') {
        const { username, password } = await request.json();
        if (!username || !password) return err('Missing username or password');

        const client = sb(env);
        const email  = plateToEmail(username.trim().toUpperCase());

        // Sign in via Supabase Auth
        const authData = await client.signIn(email, password);

        // Load full user row from users table via authId
        const rows = await client.get('users', `authId=eq.${encodeURIComponent(authData.user.id)}&limit=1`);
        if (!rows.length) return err('User profile not found', 404);

        const user = rows[0];
        if (!user.active) return err('Account is inactive', 403);

        // Strip sensitive fields before sending to browser
        const { passwordHash, lastPassword, authId, ...safeUser } = user;

        return json({
          accessToken: authData.access_token,
          refreshToken: authData.refresh_token,
          user: safeUser,
        });
      }

      // POST /auth/logout
      if (method === 'POST' && path === '/auth/logout') {
        // JWT is stateless — client clears sessionStorage. Nothing to do server-side.
        return json({ ok: true });
      }

      // ── Users ───────────────────────────────────────────────────────────────

      // PATCH /users/:id
      if (method === 'PATCH' && path.match(/^\/users\/[^/]+$/)) {
        const payload = await verifyJWT(request, env);
        const userId  = path.split('/')[2];
        const changes = await request.json();
        const role    = getRole(payload);

        // Renter can only patch their own profile (pendingEdits + language)
        if (role === 'renter') {
          const allowed = ['pendingEdits', 'language'];
          const keys = Object.keys(changes);
          if (!keys.every(k => allowed.includes(k))) return err('Forbidden', 403);
          // Must be patching own row
          const rows = await sb(env).get('users', `authId=eq.${encodeURIComponent(payload.sub)}&limit=1`);
          if (!rows.length || rows[0].id !== userId) return err('Forbidden', 403);
        } else {
          requireRole(payload, 'admin');
        }

        const client = sb(env);
        // If changing licensePlate, update username too
        if (changes.licensePlate) {
          changes.username = changes.licensePlate.toUpperCase().trim();
          changes.licensePlate = changes.username;
        }
        const result = await client.patch('users', `id=eq.${encodeURIComponent(userId)}`, changes);
        return json(result);
      }

      // DELETE /users/:id
      if (method === 'DELETE' && path.match(/^\/users\/[^/]+$/)) {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const userId = path.split('/')[2];
        const client = sb(env);

        // Check not master
        const rows = await client.get('users', `id=eq.${encodeURIComponent(userId)}&limit=1`);
        if (!rows.length) return err('User not found', 404);
        if (rows[0].role === 'master') return err('Cannot delete master admin', 403);

        // Unassign spots
        for (const spotId of (rows[0].assignedSpots || [])) {
          await client.patch('spots', `id=eq.${encodeURIComponent(spotId)}`, { assignedUserId: null, state: 'free' });
        }
        await client.delete('users', `id=eq.${encodeURIComponent(userId)}`);
        return json({ ok: true });
      }

      // POST /users/:id/password  { password }
      if (method === 'POST' && path.match(/^\/users\/[^/]+\/password$/)) {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const userId  = path.split('/')[2];
        const { password } = await request.json();
        if (!password) return err('Password required');

        const client = sb(env);
        const rows = await client.get('users', `id=eq.${encodeURIComponent(userId)}&limit=1`);
        if (!rows.length) return err('User not found', 404);
        if (rows[0].role === 'master') return err('Cannot reset master password here', 403);
        if (!rows[0].authId) return err('User has no Auth account yet — migrate first', 400);

        await client.authAdmin('PUT', `users/${rows[0].authId}`, { password });
        // Clear lastPassword for security
        await client.patch('users', `id=eq.${encodeURIComponent(userId)}`, { lastPassword: null });
        return json({ ok: true });
      }

      // POST /users/:id/role  { role }
      if (method === 'POST' && path.match(/^\/users\/[^/]+\/role$/)) {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'master');
        const userId  = path.split('/')[2];
        const { role } = await request.json();
        if (!['renter','admin'].includes(role)) return err('Invalid role');

        const client = sb(env);
        const rows = await client.get('users', `id=eq.${encodeURIComponent(userId)}&limit=1`);
        if (!rows.length) return err('User not found', 404);
        if (rows[0].role === 'master') return err('Cannot modify master', 403);

        await client.patch('users', `id=eq.${encodeURIComponent(userId)}`, { role });
        if (rows[0].authId) {
          await client.authAdmin('PUT', `users/${rows[0].authId}`, {
            app_metadata: { role }
          });
        }
        return json({ ok: true });
      }

      // ── Spots ───────────────────────────────────────────────────────────────

      // PATCH /spots/:id
      if (method === 'PATCH' && path.match(/^\/spots\/[^/]+$/)) {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const spotId  = path.split('/')[2];
        const changes = await request.json();
        const result  = await sb(env).patch('spots', `id=eq.${encodeURIComponent(spotId)}`, changes);
        return json(result);
      }

      // ── Payments ────────────────────────────────────────────────────────────

      // POST /payments  { spotId, userId, month, year, type }
      if (method === 'POST' && path === '/payments') {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const { spotId, userId, month, year, type = 'rent' } = await request.json();
        const client = sb(env);

        // Check not already paid
        const existing = await client.get('payments',
          `spotId=eq.${spotId}&month=eq.${month}&year=eq.${year}&type=eq.${type}&limit=1`);
        if (existing.length) return err('Already marked as paid');

        // Get admin's user id from authId
        const adminRows = await client.get('users', `authId=eq.${encodeURIComponent(payload.sub)}&limit=1`);
        const adminId = adminRows[0]?.id || 'admin';

        const id = 'p' + Date.now() + '_' + type;
        await client.post('payments', {
          id, spotId, userId, month, year, type,
          paidDate: new Date().toISOString().slice(0, 10),
          markedByAdminId: adminId,
        }, 'return=representation');
        return json({ ok: true });
      }

      // DELETE /payments/:id
      if (method === 'DELETE' && path.match(/^\/payments\/[^/]+$/)) {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const paymentId = path.split('/')[2];
        await sb(env).delete('payments', `id=eq.${encodeURIComponent(paymentId)}`);
        return json({ ok: true });
      }

      // ── Invites ─────────────────────────────────────────────────────────────

      // POST /invites  { name, lastName, phone, address, spotId, licensePlate, carModel, carColor }
      if (method === 'POST' && path === '/invites') {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const body   = await request.json();
        const client = sb(env);

        // Check spot is free
        const spots = await client.get('spots', `id=eq.${encodeURIComponent(body.spotId)}&limit=1`);
        if (!spots.length) return err('Spot not found', 404);
        if (spots[0].assignedUserId) return err('Spot already assigned');

        const token     = Array.from(crypto.getRandomValues(new Uint8Array(24)))
          .map(b => b.toString(16).padStart(2,'0')).join('');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const id        = 'inv' + Date.now();

        await client.post('invites', {
          id, token, spotId: body.spotId, expiresAt, usedBy: null,
          name:         body.name         || '',
          lastName:     body.lastName     || '',
          phone:        body.phone        || '',
          address:      body.address      || '',
          licensePlate: body.licensePlate || null,
          carModel:     body.carModel     || null,
          carColor:     body.carColor     || null,
        });

        // Build invite URL (Worker can't know the Pages URL, return token instead)
        return json({ token, id, expiresAt });
      }

      // PATCH /invites/:id
      if (method === 'PATCH' && path.match(/^\/invites\/[^/]+$/)) {
        const payload  = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const inviteId = path.split('/')[2];
        const changes  = await request.json();
        const result   = await sb(env).patch('invites', `id=eq.${encodeURIComponent(inviteId)}`, changes);
        return json(result);
      }

      // ── Pending registrations ───────────────────────────────────────────────

      // POST /pending-registrations  { token, name, lastName, phone, address, licensePlate, carModel, carColor, passwordHash }
      if (method === 'POST' && path === '/pending-registrations') {
        // No auth required — invite token is the authorization
        const body   = await request.json();
        const client = sb(env);

        // Validate invite
        const invites = await client.get('invites', `token=eq.${encodeURIComponent(body.token)}&limit=1`);
        const invite  = invites[0];
        if (!invite) return err('Invalid invite link', 400);
        if (invite.usedBy) return err('Invite already used', 400);
        if (new Date(invite.expiresAt) < new Date()) return err('Invite link has expired', 400);

        // Check no duplicate pending
        const dups = await client.get('pending_registrations', `token=eq.${encodeURIComponent(body.token)}&limit=1`);
        if (dups.length) return err('A registration for this invite is already pending admin approval', 400);

        // Check plate not taken
        const existing = await client.get('users', `username=eq.${encodeURIComponent(body.licensePlate)}&limit=1`);
        if (existing.length) return err('License plate already registered', 400);

        // Check spot still free
        const spots = await client.get('spots', `id=eq.${encodeURIComponent(invite.spotId)}&limit=1`);
        if (!spots.length) return err('Spot not found', 404);
        if (spots[0].assignedUserId) return err('Spot already assigned', 400);

        const id = 'pr' + Date.now();
        await client.post('pending_registrations', {
          id,
          token:        body.token,
          spotId:       invite.spotId,
          name:         body.name         || '',
          lastName:     body.lastName     || '',
          phone:        body.phone        || '',
          address:      body.address      || '',
          licensePlate: body.licensePlate,
          carModel:     body.carModel,
          carColor:     body.carColor,
          passwordHash: body.password || null,  // stored temporarily, used on approve
          submittedAt:  new Date().toISOString(),
        });
        return json({ ok: true, id });
      }

      // POST /pending-registrations/:id/approve
      if (method === 'POST' && path.match(/^\/pending-registrations\/[^/]+\/approve$/)) {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const prId    = path.split('/')[2];
        const client  = sb(env);

        const prs = await client.get('pending_registrations', `id=eq.${encodeURIComponent(prId)}&limit=1`);
        if (!prs.length) return err('Pending registration not found', 404);
        const pr = prs[0];

        // Re-validate
        const invites = await client.get('invites', `token=eq.${encodeURIComponent(pr.token)}&limit=1`);
        const invite  = invites[0];
        if (!invite || invite.usedBy) return err('Invite already used or invalid', 400);

        const spots = await client.get('spots', `id=eq.${encodeURIComponent(pr.spotId)}&limit=1`);
        if (!spots.length || spots[0].assignedUserId) return err('Spot already assigned', 400);

        const users = await client.get('users', `username=eq.${encodeURIComponent(pr.licensePlate)}&limit=1`);
        if (users.length) return err('License plate already registered', 400);

        // Create Supabase Auth user with the password the user chose during registration
        const email = plateToEmail(pr.licensePlate);
        const userPassword = pr.passwordHash; // stored as plain text during pending phase
        if (!userPassword) return err('No password stored for this registration', 400);

        const authUser = await client.authAdmin('POST', 'users', {
          email,
          password: userPassword,
          email_confirm: true,
          app_metadata: { role: 'renter' },
        });

        const userId = 'u' + Date.now();
        await Promise.all([
          client.post('users', {
            id:           userId,
            username:     pr.licensePlate,
            passwordHash: null,
            lastPassword: null,
            authId:       authUser.id,
            name:         pr.name,
            lastName:     pr.lastName,
            phone:        pr.phone,
            address:      pr.address,
            licensePlate: pr.licensePlate,
            carModel:     pr.carModel,
            carColor:     pr.carColor,
            role:         'renter',
            active:       true,
            assignedSpots:[pr.spotId],
            pendingEdits: null,
            registeredAt: pr.submittedAt,
          }),
          client.patch('spots', `id=eq.${encodeURIComponent(pr.spotId)}`, {
            assignedUserId: userId, state: 'occupied'
          }),
          client.patch('invites', `id=eq.${encodeURIComponent(invite.id)}`, { usedBy: userId }),
          client.delete('pending_registrations', `id=eq.${encodeURIComponent(prId)}`),
        ]);

        // Return userId so admin panel can update UI
        return json({ ok: true, userId });
      }

      // DELETE /pending-registrations/:id  (reject)
      if (method === 'DELETE' && path.match(/^\/pending-registrations\/[^/]+$/)) {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'admin');
        const prId = path.split('/')[2];
        await sb(env).delete('pending_registrations', `id=eq.${encodeURIComponent(prId)}`);
        return json({ ok: true });
      }

      // ── Incidents ───────────────────────────────────────────────────────────

      // POST /incidents  { spotId, observedPlate, note, imageUrl, filePath }
      if (method === 'POST' && path === '/incidents') {
        const payload = await verifyJWT(request, env);
        const client  = sb(env);
        const body    = await request.json();

        const rows = await client.get('users', `authId=eq.${encodeURIComponent(payload.sub)}&limit=1`);
        if (!rows.length) return err('User not found', 404);

        const id = 'inc' + Date.now();
        await client.post('incidents', {
          id,
          spotId:           body.spotId,
          reportedByUserId: rows[0].id,
          observedPlate:    body.observedPlate || null,
          note:             body.note          || null,
          imageUrl:         body.imageUrl,
          filePath:         body.filePath,
          reportedAt:       new Date().toISOString(),
        });
        return json({ ok: true, id });
      }

      // DELETE /incidents/:id
      if (method === 'DELETE' && path.match(/^\/incidents\/[^/]+$/)) {
        const payload    = await verifyJWT(request, env);
        const incidentId = path.split('/')[2];
        const client     = sb(env);

        // Load incident to check ownership
        const rows = await client.get('incidents', `id=eq.${encodeURIComponent(incidentId)}&limit=1`);
        if (!rows.length) return err('Incident not found', 404);

        const role = getRole(payload);
        if (role !== 'admin' && role !== 'master') {
          // Renter can only delete own incidents
          const userRows = await client.get('users', `authId=eq.${encodeURIComponent(payload.sub)}&limit=1`);
          if (!userRows.length || rows[0].reportedByUserId !== userRows[0].id) {
            return err('Forbidden', 403);
          }
        }

        await client.delete('incidents', `id=eq.${encodeURIComponent(incidentId)}`);
        return json({ ok: true });
      }

      // ── Admin — migrate existing user to Supabase Auth ──────────────────────

      // POST /admin/migrate-user/:id
      if (method === 'POST' && path.match(/^\/admin\/migrate-user\/[^/]+$/)) {
        const payload = await verifyJWT(request, env);
        requireRole(payload, 'master');
        const userId  = path.split('/')[3];
        const client  = sb(env);

        const rows = await client.get('users', `id=eq.${encodeURIComponent(userId)}&limit=1`);
        if (!rows.length) return err('User not found', 404);
        const user = rows[0];
        if (user.authId) return err('User already migrated', 400);

        const email = plateToEmail(user.licensePlate || user.username);
        const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2,'0')).join('');

        const authUser = await client.authAdmin('POST', 'users', {
          email,
          password: tempPassword,
          email_confirm: true,
          app_metadata: { role: user.role },
        });

        await client.patch('users', `id=eq.${encodeURIComponent(userId)}`, {
          authId: authUser.id,
          lastPassword: null,
        });

        return json({ ok: true, authId: authUser.id, tempPassword, email });
      }

      return err('Not found', 404);

    } catch (e) {
      if (e.message === 'Unauthorized' || e.message === 'Token expired' || e.message === 'Invalid token signature') {
        return err(e.message, 401);
      }
      if (e.message === 'Forbidden') {
        return err(e.message, 403);
      }
      console.error(e);
      return err(e.message || 'Internal error', 500);
    }
  },
};
