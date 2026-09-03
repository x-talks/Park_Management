// Pure client-rendered SPA for GitHub Pages.
// ssr:false renders every route in the browser (data is fetched client-side with
// the user's JWT). The adapter-static `fallback: index.html` serves the shell for
// all routes, so we do NOT prerender individual routes.
export const prerender = false;
export const ssr = false;

