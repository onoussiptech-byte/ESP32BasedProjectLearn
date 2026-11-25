/* ESP32 Tour service worker. It only makes the app's OWN files available offline.
 * - Files listed below: served from the cache first (works with no connection).
 * - Anything else (other origins, online links, POSTs): passed straight through, never touched or blocked.
 * - A new version waits until the app asks for it: at start, or when the person taps "Reload". Versions up to 0.7.1
 *   only had the message, so a new version takes over from them by itself. */
const CACHE = 'esp32tour-v0.7.2';
const DOCS = 'esp32tour-docs-1';        // documents and PDF viewer: kept when the app is updated, not downloaded again
const FILES = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "app/app.js",
 "app/auth.js",
 "app/course.js",
 "app/crypto.js",
 "app/dashboard.js",
 "app/fonts.css",
 "app/i18n.js",
 "app/icons.js",
 "app/lessons.js",
 "app/overview.js",
 "app/pdfview.js",
 "app/prism.js",
 "app/pwa.js",
 "app/quiz.js",
 "app/store.js",
 "app/styles.css",
 "app/ui.js",
 "content/t1.l01.s01.js",
 "content/t1.l01.s02.js",
 "content/t3.l01.s01.js",
 "content/t3.l01.s02.js",
 "figures/aquaponics-cycle.webp",
 "figures/aquaponics-parts.webp",
 "figures/d1n5819-photo.webp",
 "figures/dcjack-photo.webp",
 "figures/dosingpump-photo.webp",
 "figures/ds18b20-pinout.webp",
 "figures/esp32-pins.webp",
 "figures/float-photo.webp",
 "figures/fuse-photo.webp",
 "figures/hw-power.webp",
 "figures/irlz44n-package.webp",
 "figures/lm2596-pins.webp",
 "figures/lm2596-typical.webp",
 "figures/ph4502c-pinout.webp",
 "figures/resistor-photo.webp",
 "figures/sqp-photo.webp",
 "figures/toggle-photo.webp",
 "figures/waterpump-drawing.webp",
 "figures/yfs201-photo.webp",
 "fonts/inter-latin-400.woff2",
 "fonts/inter-latin-500.woff2",
 "fonts/inter-latin-600.woff2",
 "fonts/inter-latin-700.woff2",
 "fonts/inter-latin-ext-400.woff2",
 "fonts/inter-latin-ext-500.woff2",
 "fonts/inter-latin-ext-600.woff2",
 "fonts/inter-latin-ext-700.woff2",
 "fonts/jetbrains-mono-latin-400.woff2",
 "fonts/jetbrains-mono-latin-600.woff2",
 "fonts/jetbrains-mono-latin-ext-400.woff2",
 "fonts/jetbrains-mono-latin-ext-600.woff2",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "data/accounts.js"
];

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
