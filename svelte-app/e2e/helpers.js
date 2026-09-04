// e2e/helpers.js — Svelte app E2E helpers
// Routes use SvelteKit paths (/parking, /admin) — no .html extension.

export async function loginAs(page, username, password) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto('/');
    const usernameInput = page.locator('#username, input[name="username"], input[placeholder*="plate" i], input[placeholder*="user" i]').first();
    const passwordInput = page.locator('#password, input[type="password"]').first();
    await usernameInput.fill(username);
    await passwordInput.fill(password);
    await page.locator('button[type="submit"]').click();

    // Either we land on the target route or the login error appears.
    const result = await Promise.race([
      page.waitForURL(url => /\/(parking|admin)/.test(url.toString()), { timeout: 20_000 })
        .then(() => 'ok'),
      page.locator('.alert.error, [class*="alert"][class*="error"]').waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'error'),
    ]).catch(() => 'timeout');

    if (result === 'ok') return;
    if (attempt < 3) await page.waitForTimeout(5_000); // let worker warm up
  }
  // Last-chance wait — if we're already on the right URL we're done
  await page.waitForURL(url => /\/(parking|admin)/.test(url.toString()), { timeout: 10_000 });
}

export async function waitForAppReady(page, role = 'renter') {
  // Always wait for SVG spots on parking page; user-list only on admin page
  const url = page.url();
  if ((role === 'admin' || role === 'master') && /\/admin/.test(url)) {
    await page.locator('#user-list table tr').first().waitFor({ state: 'visible', timeout: 25_000 });
  } else {
    await page.locator('svg g[data-id]').first().waitFor({ state: 'visible', timeout: 25_000 });
  }
}
