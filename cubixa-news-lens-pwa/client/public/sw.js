/*
 * Cubixa News Lens — Service Worker
 *
 * Goals:
 *  1. Provide an installable PWA shell (basic offline page)
 *  2. Cache static assets after first load (cache-first for icons/fonts)
 *  3. Network-first for HTML so users always see the latest UI
 *  4. NEVER cache POST /analyze requests — analysis must always hit network
 */

const VERSION = "cnl-v1";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass everything that isn't a GET (analyze POSTs, etc.)
  if (req.method !== "GET") return;

  // Bypass API calls to the backend
  if (url.pathname.startsWith("/analyze")) return;

  // Navigation requests → network-first, fall back to cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("/")))
    );
    return;
  }

  // Static assets (icons / fonts / scripts) → cache-first
  if (
    url.origin === self.location.origin ||
    /fonts\.gstatic|fonts\.googleapis|cdn\.jsdelivr/.test(url.host)
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            if (res.ok && res.type !== "opaqueredirect") {
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
