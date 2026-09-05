import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const raw = process.env.BASE_PATH ?? '';
const base = raw === '' ? '' : raw.startsWith('/') ? raw : `/${raw}`;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		paths: { base }
	}
};

export default config;
