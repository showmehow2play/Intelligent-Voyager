const CACHE_NAME = 'travel-next-mvp-v4';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon.svg', './logo.svg', './supabase-client.js', './supabase/config.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME && (key.startsWith('voyagea-') || key.startsWith('nordicexplorer-') || key.startsWith('travel-next-')))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
