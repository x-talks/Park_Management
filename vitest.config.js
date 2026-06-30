import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.{test,spec}.js'],
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js'],
      exclude: ['js/config.js', 'js/i18n/en.js', 'js/i18n/de.js', 'js/i18n/tr.js'],
    },
  },
});
