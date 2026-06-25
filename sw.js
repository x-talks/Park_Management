// sw.js — minimal service worker for PWA installability
// Caches app shell for offline use

const CACHE = 'pm-v1';
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

// Network-first for API calls, cache-first for shell assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin (Supabase, worker, CDN)
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Cache-first for shell files
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});
