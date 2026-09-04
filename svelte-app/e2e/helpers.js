// e2e/helpers.js — Svelte app E2E helpers
// Routes use SvelteKit paths (/parking, /admin) — no .html extension.

export async function loginAs(page, username, password) {
  await page.goto('/');
  const usernameInput = page.locator('#username, input[name="username"], input[placeholder*="plate" i], input[placeholder*="user" i]').first();
  const passwordInput = page.locator('#password, input[type="password"]').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for redirect to /parking or /admin
  await page.waitForURL(url => /\/(parking|admin)/.test(url.toString()), { timeout: 25_000 });
}

export async function waitForAppReady(page, role = 'renter') {
  if (role === 'admin' || role === 'master') {
    await page.locator('#user-list table tr').first().waitFor({ state: 'visible', timeout: 25_000 });
  } else {
    await page.locator('svg g[data-id]').first().waitFor({ state: 'visible', timeout: 25_000 });
  }
}
