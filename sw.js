// sw.js — service worker for PWA installability + offline fallback
//
// Strategy: NETWORK-FIRST for the app shell (HTML/CSS/JS). When online, users
// always get the freshly deployed files; the cache is only a fallback for
// offline use. This prevents the classic "deployed but users still see the old
// version" problem caused by cache-first serving.
//
// IMPORTANT: bump CACHE on every meaningful frontend change so the `activate`
// handler purges stale caches. The date suffix makes the current version
// obvious; change it whenever the shell files change.
const CACHE = 'pm-2026-07-14';
const SHELL = [
  '/',
  '/index.html',
  '/parking.html',
  '/incident.html',
  '/admin.html',
  '/css/style.css',
  '/js/config.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/i18n.js',
  '/js/i18n/en.js',
  '/js/i18n/de.js',
  '/js/i18n/tr.js',
  '/js/modal.js',
  '/js/toast.js',
  '/js/theme.js',
  '/js/parking.js',
  '/js/admin.js',
  '/logo.png',
  '/manifest.json'
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

// Network-first for same-origin GET (app shell). Fall back to cache offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin (Supabase, worker, CDN) — let them hit network directly.
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache a fresh copy of successful responses for offline fallback.
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
