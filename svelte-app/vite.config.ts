import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// GitHub Pages serves this app under a subpath in production.
// BASE_PATH is injected by CI (e.g. "/Park_Management/svelte-app"); empty in dev.
// SvelteKit requires base to be "" or start with "/".
const raw = process.env.BASE_PATH ?? '';
const base: '' | `/${string}` = raw === '' ? '' : raw.startsWith('/') ? (raw as `/${string}`) : `/${raw}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Static adapter → prerendered SPA for GitHub Pages (matches the current
			// vanilla app's static deploy model; data is fetched client-side with the
			// user's JWT, so no SSR is needed).
			adapter: adapter({
				fallback: 'index.html' // SPA fallback so client-side routing works on Pages
			}),
			paths: { base }
		})
	]
});
