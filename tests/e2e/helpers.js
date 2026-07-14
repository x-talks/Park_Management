// tests/e2e/helpers.js
export async function loginAs(page, username, password) {
  await page.goto('/');
  const usernameInput = page.locator('#username, input[name="username"], input[placeholder*="plate" i], input[placeholder*="user" i]').first();
  const passwordInput = page.locator('#password, input[type="password"]').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').click();
  // Login should complete quickly now that workerRequest has a 10s timeout + retry.
  await page.waitForURL(url => !url.toString().endsWith('index.html') && !url.toString().endsWith('/'), { timeout: 15_000 });
}

// Wait for a page's data-driven content to render, instead of the flaky
// waitForLoadState('networkidle') which never settles because parking.html and
// admin.html run a 30s setInterval poll.
export async function waitForAppReady(page, role = 'renter') {
  if (role === 'admin' || role === 'master') {
    // Admin page: renderUsers() builds a <table> of <tr> rows inside #user-list.
    await page.locator('#user-list table tr').first().waitFor({ state: 'visible', timeout: 15_000 });
  } else {
    // Renter/parking page: wait for the SVG map to render at least one spot.
    await page.locator('svg g[data-id]').first().waitFor({ state: 'visible', timeout: 15_000 });
  }
}
