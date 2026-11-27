/* ESP32 Tour service worker. It only makes the app's OWN files available offline.
 * - Files listed below: served from the cache first (works with no connection).
 * - Anything else (other origins, online links, POSTs): passed straight through, never touched or blocked.
 * - A new version waits until the app asks for it: at start, or when the person taps "Reload". Versions up to 0.7.1
 *   only had the message, so a new version takes over from them by itself. */
const CACHE = 'esp32tour-v{{VERSION}}';
const DOCS = 'esp32tour-docs-1';        // documents and PDF viewer: kept when the app is updated, not downloaded again
const FILES = {{FILES}};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));   // 'reload': never an old copy from the browser's own cache
    const keys = await caches.keys();
    if (keys.some((k) => /^esp32tour-v0\.([0-6]\.\d+|7\.[01])$/.test(k))) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('esp32tour-') && k !== CACHE && k !== DOCS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // not ours: pass through
  const path0 = url.pathname.slice(new URL('./', self.location).pathname.length);
  if (req.cache === 'reload' && (path0.startsWith('docs/') || path0.startsWith('pdfjs/'))) return;   // DocStore refreshing a changed copy: network only
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      const path = url.pathname.slice(new URL('./', self.location).pathname.length);
      if (path.startsWith('docs/') || path.startsWith('pdfjs/')) {                // keep it for the next time
        return fetch(req).then((res) => {
          if (res.status !== 200) return res;
          const copy = res.clone();
          event.waitUntil(caches.open(DOCS).then((c) => c.put(url.origin + url.pathname, copy)));
          return res;
        });
      }
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    }));
});
