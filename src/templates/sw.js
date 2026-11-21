/* ESP32 Tour service worker. It only makes the app's OWN files available offline.
 * - Files listed below: served from the cache first (works with no connection).
 * - Anything else (other origins, online links, POSTs): passed straight through, never touched or blocked.
 * - A new version waits until the person taps "Reload" in the "Update available" message. */
const CACHE = 'esp32tour-v{{VERSION}}';
const FILES = {{FILES}};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));   // no skipWaiting: the person decides
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('esp32tour-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // not ours: pass through
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    }));
});
