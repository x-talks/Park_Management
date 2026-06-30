// tests/fixtures/playwright-global-teardown.js
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

export default async function globalTeardown() {
  try {
    execSync('node tests/fixtures/teardown.js', { cwd: root, stdio: 'inherit' });
  } catch (e) {
    console.warn('Teardown failed:', e.message);
  }

  const pid = parseInt(process.env.SERVE_PID || '0', 10);
  if (pid) {
    try {
      process.kill(-pid);
    } catch (_) {}
  }

  try {
    execSync('git checkout js/config.js', { cwd: root, stdio: 'ignore' });
  } catch (_) {}

  console.log('✓ Global teardown complete');
}
