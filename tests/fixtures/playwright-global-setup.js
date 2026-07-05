// tests/fixtures/playwright-global-setup.js
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

export default async function globalSetup() {
  execSync('node tests/fixtures/staging-config.js', { cwd: root, stdio: 'inherit' });
  execSync('node tests/fixtures/seed.js', { cwd: root, stdio: 'inherit' });
  console.log('✓ Global setup complete');
}
