import { defineConfig } from 'vitest/config';

// Unit tests only — pure TS utils (payments, spot classification, plate validation).
// SvelteKit component/E2E tests run via Playwright separately.
export default defineConfig({
	test: {
		include: ['src/**/*.{test,spec}.ts'],
		environment: 'node'
	}
});
