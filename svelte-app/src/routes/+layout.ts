// Pure client-rendered SPA for GitHub Pages.
// ssr:false + prerender:true generates a static HTML shell for every route,
// so GitHub Pages can serve /parking, /admin etc. as physical files without
// needing a 404.html redirect hack (which only works at the domain root).
export const prerender = true;
export const ssr = false;

