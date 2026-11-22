// Self-clearing Service Worker to prevent stale HTML / script hash caching white-screen bugs
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    })
  );
  self.clients.claim();
});

// Network-only: never intercept HTML or scripts with stale cache
self.addEventListener('fetch', (event) => {
  return;
});
