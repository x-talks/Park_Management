// tests/fixtures/teardown.js
// Wipes all staging tables after E2E tests.
// Run after E2E tests: node tests/fixtures/teardown.js
// Requires: STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_KEY env vars.

import { createClient } from '@supabase/supabase-js';

const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Missing required env vars: STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });

async function teardown() {
  console.log('Tearing down staging database...');

  for (const table of ['payments', 'incidents', 'pending_registrations', 'invites', 'spots', 'users']) {
    const res = await fetch(`${url}/rest/v1/${table}?id=not.is.null`, {
      method: 'DELETE',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`  ! ${table}: ${text}`);
    } else {
      console.log(`  ✓ ${table} cleared`);
    }
  }

  const { data, error } = await supa.auth.admin.listUsers();
  if (error) {
    console.warn('  ! could not list auth users:', error.message);
  } else {
    for (const user of data.users) {
      await supa.auth.admin.deleteUser(user.id);
    }
    console.log(`  ✓ auth users deleted (${data.users.length})`);
  }

  console.log('Teardown complete.');
}

teardown().catch(err => {
  console.error('Teardown failed:', err.message);
  process.exit(1);
});
