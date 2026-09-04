// sw.js — network-first PWA shell cache for the SvelteKit build
// Bump CACHE on every meaningful deploy so `activate` purges stale caches.
const CACHE = 'pm-svelte-2026-09-04-a';

// SvelteKit SPA: only the root entry points need explicit pre-caching.
// Hashed JS/CSS chunks are auto-cached by the fetch handler on first visit.
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin GET. Fall back to cache when offline.
// Cross-origin requests (Supabase, Worker, fonts) skip through to network.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
