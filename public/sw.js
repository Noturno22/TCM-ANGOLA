// Tira o Cocó do Meio — minimal service worker (network-first, offline fallback)
const CACHE_NAME = 'tcm-shell-v1';
const OFFLINE_URL = '/';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Same-origin navigations only; never cache API calls.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok && request.mode === 'navigate') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(OFFLINE_URL, response.clone());
        }
        return response;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(OFFLINE_URL);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
