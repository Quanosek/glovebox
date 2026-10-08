/*
 * Offline support (custom service worker, no external libraries).
 *
 * `npm run build` runs scripts/generate-precache.mjs, which replaces the
 * placeholder below in out/sw.js with the build version and the list of all
 * exported files. Every build therefore produces a new worker that
 * precaches the whole app (pages, RSC payloads, scripts, styles, images).
 */
/* global self, caches, fetch, URL, Response */

const PRECACHE = self.__PRECACHE_MANIFEST || { version: "dev", urls: [] };
const PREFIX = "opel-cascada-manual-";
const CACHE = `${PREFIX}${PRECACHE.version}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const urls = PRECACHE.urls;
      const BATCH = 20;
      for (let i = 0; i < urls.length; i += BATCH) {
        await Promise.all(
          urls.slice(i, i + BATCH).map(async (url) => {
            try {
              const res = await fetch(url, { cache: "no-cache" });
              if (res.ok && !res.redirected) await cache.put(url, res);
            } catch {
              // Skip single failures; the file is cached on first use instead.
            }
          }),
        );
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const isImmutable = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/assets/");

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

async function networkFirst(request) {
  const url = new URL(request.url);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected) {
      const cache = await caches.open(CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const candidates = [request.url, url.pathname, url.pathname.replace(/\/$/, "") || "/"];
    for (const c of candidates) {
      const hit = await caches.match(c, { ignoreSearch: true });
      if (hit) return hit;
    }
    if (request.mode === "navigate") {
      const notFound = await caches.match("/404");
      if (notFound) return notFound;
      return new Response("Brak połączenia, a ta strona nie jest zapisana offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(isImmutable(url) ? cacheFirst(request) : networkFirst(request));
});
