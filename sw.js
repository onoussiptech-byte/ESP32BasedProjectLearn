/* ESP32 Tour service worker. It only makes the app's OWN files available offline.
 * - Files listed below: served from the cache first (works with no connection).
 * - Anything else (other origins, online links, POSTs): passed straight through, never touched or blocked.
 * - A new version waits until the person taps "Reload" in the "Update available" message. */
const CACHE = 'esp32tour-v0.3.0';
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
 "app/prism.js",
 "app/pwa.js",
 "app/quiz.js",
 "app/store.js",
 "app/styles.css",
 "app/ui.js",
 "content/t1.l01.s01.js",
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
