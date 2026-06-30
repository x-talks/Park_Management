// tests/fixtures/playwright-global-setup.js
import { execSync, spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

export default async function globalSetup() {
  execSync('node tests/fixtures/staging-config.js', { cwd: root, stdio: 'inherit' });
  execSync('node tests/fixtures/seed.js', { cwd: root, stdio: 'inherit' });

  const server = spawn('npx', ['serve', '.', '--listen', '3000'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
  });
  server.unref();
  process.env.SERVE_PID = String(server.pid);

  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('✓ Global setup complete: server started on :3000');
}
