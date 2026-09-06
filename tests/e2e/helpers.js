// tests/e2e/helpers.js
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

const STATE_FILES = {
  'TEST-ADMIN':  resolve(root, 'tests/fixtures/auth-admin.json'),
  'HD-AA-001':   resolve(root, 'tests/fixtures/auth-renter.json'),
  'HD-BB-002':   resolve(root, 'tests/fixtures/auth-renter.json'),
  'TEST-MASTER': resolve(root, 'tests/fixtures/auth-master.json'),
};

// Fast login: inject saved storageState then navigate directly to the app.
// Falls back to form-based login if no saved state exists for the username.
export async function loginAs(page, username, password) {
  const stateFile = STATE_FILES[username];
  if (stateFile) {
    try {
      const { readFileSync } = await import('fs');
      const state = JSON.parse(readFileSync(stateFile, 'utf8'));
      await page.context().addInitScript(() => {});
      // Inject localStorage items before navigation
      const items = state.origins?.[0]?.localStorage ?? [];
      await page.context().storageState(); // ensure context is ready
      await page.goto('/parking.html');
      await page.evaluate(items => {
        items.forEach(({ name, value }) => localStorage.setItem(name, value));
      }, items);
      // Navigate to the right landing page based on role
      const user = JSON.parse(items.find(i => i.name === 'pm_user')?.value || '{}');
      const dest = (user.role === 'admin' || user.role === 'master') ? '/admin.html' : '/parking.html';
      await page.goto(dest);
      return;
    } catch (_) {
      // fall through to form login if state file missing
    }
  }
  await loginAsViaForm(page, username, password);
}

// Form-based login — used by auth.spec.js and as fallback.
export async function loginAsViaForm(page, username, password) {
  await page.goto('/');
  const usernameInput = page.locator('#username, input[name="username"], input[placeholder*="plate" i], input[placeholder*="user" i]').first();
  const passwordInput = page.locator('#password, input[type="password"]').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.toString().endsWith('index.html') && !url.toString().endsWith('/'), { timeout: 25_000 });
}

// Wait for a page's data-driven content to render, instead of the flaky
// waitForLoadState('networkidle') which never settles because parking.html and
// admin.html run a 30s setInterval poll.
export async function waitForAppReady(page, role = 'renter') {
  if (role === 'admin' || role === 'master') {
    await page.locator('#user-list table tr').first().waitFor({ state: 'visible', timeout: 25_000 });
  } else {
    await page.locator('svg g[data-id]').first().waitFor({ state: 'visible', timeout: 25_000 });
  }
}
