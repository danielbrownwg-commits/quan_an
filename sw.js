/* Places — service worker
 * Strategy:
 *   - CORE (app shell): precached on install with { cache: 'reload' }, served cache-first
 *     without background updates to prevent version skew between HTML/CSS/JS modules.
 *   - Other same-origin GET requests: stale-while-revalidate.
 * All paths are RELATIVE so it works under GitHub Pages at https://user.github.io/repo/
 * IMPORTANT: Every release MUST bump CACHE_VERSION to install a new SW and delete the old cache.
 */
const CACHE_VERSION = 'v4';
const CACHE = `places-${CACHE_VERSION}`;
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './fonts/be-vietnam-pro-400-latin.woff2',
  './fonts/be-vietnam-pro-600-latin.woff2',
  './fonts/be-vietnam-pro-400-vietnamese.woff2',
  './fonts/be-vietnam-pro-600-vietnamese.woff2',
  './css/fonts.css',
  './css/theme.css',
  './css/base.css',
  './css/components.css',
  './css/tall-phone.css',
  './js/main.js',
  './js/util.js',
  './js/seed.js',
  './js/db.js',
  './js/image.js',
  './js/state.js',
  './js/ui.js',
  './js/render.js',
  './js/backup.js',
  './js/sw-register.js',
  './js/views/detail.js',
  './js/views/form.js',
  './js/views/filter.js',
  './js/views/stats.js',
  './js/views/random.js',
  './js/views/settings.js',
  './js/views/fields-editor.js'
];
const CORE_URLS = new Set(CORE.map((u) => new URL(u, self.location.href).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
  // No automatic skipWaiting: the app asks the user first, then activates the new version (see message handler below)
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('places-') && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// index.html sends { type: 'SKIP_WAITING' } when the user taps "Update" on the toast
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin requests alone

  const isCore = CORE_URLS.has(url.origin + url.pathname) || req.mode === 'navigate';

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      let cached = await cache.match(req, { ignoreSearch: true });
      if (!cached && req.mode === 'navigate') cached = await cache.match('./index.html');

      if (isCore) {
        if (cached) return cached;
        return (await fetch(req).catch(() => null)) || Response.error();
      }

      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(network); // background update for the next open
        return cached;
      }
      return (await network) || Response.error();
    })()
  );
});
