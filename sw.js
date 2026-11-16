// Service worker: cache powłoki aplikacji (offline-start). Dźwięk i API idą zawsze przez sieć.
const V = 'muzyka-v2';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'player.js', 'store.js', 'util.js',
  'providers/index.js', 'providers/jamendo.js', 'providers/audius.js', 'providers/archive.js', 'providers/radio.js', 'providers/podcasts.js', 'sync.js',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network-first: zawsze świeży kod, cache jako zapas offline
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(V).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
