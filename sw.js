/* Places — service worker
 * Chiến lược: precache app shell, sau đó stale-while-revalidate (mở nhanh từ cache, cập nhật ngầm).
 * Mọi đường dẫn đều RELATIVE để chạy được dưới GitHub Pages dạng https://user.github.io/repo/
 * Khi thay đổi lớn: tăng CACHE_VERSION để cài SW mới và xóa cache cũ.
 */
const CACHE_VERSION = 'v1';
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
  // Không skipWaiting tự động: để app hỏi người dùng rồi mới kích hoạt bản mới (xem message bên dưới)
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

// index.html gửi { type: 'SKIP_WAITING' } khi người dùng bấm "Cập nhật" trên toast
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // không đụng request ngoài origin

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
        event.waitUntil(network); // cập nhật ngầm cho lần mở sau
        return cached;
      }
      return (await network) || Response.error();
    })()
  );
});
