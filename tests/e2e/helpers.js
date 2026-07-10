// tests/e2e/helpers.js
export async function loginAs(page, username, password) {
  await page.goto('/');
  // Exact IDs from index.html: #username, #password
  const usernameInput = page.locator('#username, input[name="username"], input[placeholder*="plate" i], input[placeholder*="user" i]').first();
  const passwordInput = page.locator('#password, input[type="password"]').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.toString().endsWith('index.html') && !url.toString().endsWith('/'), { timeout: 30_000 });
}
