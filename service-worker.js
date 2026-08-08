// service-worker.js
//
// HONEST SCOPE:
// - This gives you: offline app-shell caching + installability
//   ("Add to Home Screen" on Android/desktop, works on iOS Safari too
//   via the manifest + meta tags already in silent-grind.html).
// - This does NOT give you: true background push notifications when
//   the app is fully closed. That requires a push subscription
//   (VAPID keys) plus a server that triggers the push — a real backend
//   component, not something a static service worker can do alone.
//   The in-app Notification calls in silent-grind.html still only fire
//   while that tab/app is open, same as before.

const CACHE_NAME = 'silent-grind-v1';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for app-shell / known assets, network-first fallback for
// everything else (so new deploys still show up once online).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
