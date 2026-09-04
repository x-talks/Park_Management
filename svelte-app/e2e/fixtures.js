// e2e/fixtures.js — observability fixture (identical to vanilla suite)
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  _observability: [async ({ page }, use, testInfo) => {
    const logs = [];
    const failures = [];

    page.on('console', msg => { logs.push(`[console.${msg.type()}] ${msg.text()}`); });
    page.on('pageerror', err => { logs.push(`[pageerror] ${err.message}`); });
    page.on('requestfailed', req => {
      const f = req.failure();
      failures.push(`[requestfailed] ${req.method()} ${req.url()} — ${f ? f.errorText : 'unknown'}`);
    });
    page.on('response', async res => {
      if (res.status() >= 400) {
        let bodySnippet = '';
        try { bodySnippet = (await res.text()).slice(0, 500); } catch (_) {}
        failures.push(`[response ${res.status()}] ${res.request().method()} ${res.url()} — ${bodySnippet}`);
      }
    });

    await use();

    if (testInfo.status !== testInfo.expectedStatus) {
      if (logs.length) await testInfo.attach('browser-console.txt', { body: logs.join('\n'), contentType: 'text/plain' });
      if (failures.length) await testInfo.attach('network-failures.txt', { body: failures.join('\n'), contentType: 'text/plain' });
    }
  }, { auto: true }],
});

export { expect };
