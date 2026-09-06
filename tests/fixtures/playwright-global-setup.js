// tests/fixtures/playwright-global-setup.js
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

async function fetchAuthState(workerUrl, username, password) {
  const res = await fetch(`${workerUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${username}: ${res.status} ${await res.text()}`);
  const { accessToken, refreshToken, user } = await res.json();

  // Playwright storageState format — mirrors what the app sets in localStorage
  return {
    cookies: [],
    origins: [{
      origin: 'http://localhost:3000',
      localStorage: [
        { name: 'pm_access_token',  value: accessToken },
        { name: 'pm_refresh_token', value: refreshToken || '' },
        { name: 'pm_user',          value: JSON.stringify(user) },
      ],
    }],
  };
}

export default async function globalSetup() {
  if (!process.env.SKIP_SEED) {
    execSync('node tests/fixtures/staging-config.js', { cwd: root, stdio: 'inherit' });
    execSync('node tests/fixtures/seed.js',           { cwd: root, stdio: 'inherit' });
  }

  const workerUrl     = process.env.STAGING_WORKER_URL;
  const adminPass     = process.env.STAGING_ADMIN_PASSWORD;
  const masterPass    = process.env.STAGING_MASTER_PASSWORD;

  if (!workerUrl || !adminPass || !masterPass) {
    throw new Error('Missing STAGING_WORKER_URL / STAGING_ADMIN_PASSWORD / STAGING_MASTER_PASSWORD');
  }

  const [adminState, renterState, masterState] = await Promise.all([
    fetchAuthState(workerUrl, 'TEST-ADMIN',  adminPass),
    fetchAuthState(workerUrl, 'HD-AA-001',   'TestPass123!'),
    fetchAuthState(workerUrl, 'TEST-MASTER', masterPass),
  ]);

  writeFileSync(resolve(root, 'tests/fixtures/auth-admin.json'),   JSON.stringify(adminState));
  writeFileSync(resolve(root, 'tests/fixtures/auth-renter.json'),  JSON.stringify(renterState));
  writeFileSync(resolve(root, 'tests/fixtures/auth-master.json'),  JSON.stringify(masterState));

  console.log('✓ Global setup complete (auth states saved)');
}
