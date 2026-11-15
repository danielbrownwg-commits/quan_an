/* Places — service worker
 * Strategy: precache the app shell, then stale-while-revalidate (open fast from cache, update in the background).
 * All paths are RELATIVE so it works under GitHub Pages at https://user.github.io/repo/
 * On major changes: bump CACHE_VERSION to install a new SW and delete the old cache.
 */
const CACHE_VERSION = 'v2';
const CACHE = `places-${CACHE_VERSION}`;
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
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

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      let cached = await cache.match(req, { ignoreSearch: true });
      if (!cached && req.mode === 'navigate') cached = await cache.match('./index.html');

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
