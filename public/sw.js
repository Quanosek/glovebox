/*
 * Offline support (custom service worker, no external libraries).
 *
 * The app is served by a local Next.js server, so pages are cached at
 * runtime:
 * - `/_next/static/*`: cache-first (file names are content hashed);
 * - `/media/*` (manual illustrations): stale-while-revalidate;
 * - pages and the search index: network-first with a cached fallback.
 * "Zapisz do użytku offline" on a car page fills OFFLINE_CACHE with every
 * page and image of that car (see src/components/CarActions.tsx).
 * Mutating and status API routes are never cached.
 */
/* global self, caches, fetch, URL, Response */

const PREFIX = "opel-cascada-manual-";
const CACHE = `${PREFIX}runtime-v2`;
const OFFLINE_CACHE = `${PREFIX}offline-v1`;
const SHELL = ["/", "/auta", "/notatnik", "/komentarze", "/zakladki", "/ustawienia"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-cache" });
            if (res.ok && !res.redirected) await cache.put(url, res);
          } catch {
            // cached on first use instead
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [CACHE, OFFLINE_CACHE];
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && !keep.includes(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function put(request, res) {
  if (res.ok && !res.redirected && res.type === "basic") {
    const cache = await caches.open(CACHE);
    await cache.put(request, res);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cached = await caches.match(request);
  const network = fetch(request).then((res) => {
    put(request, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

async function networkFirst(request) {
  const url = new URL(request.url);
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  try {
    const res = await fetch(request);
    put(request, res.clone());
    return res;
  } catch (err) {
    const exact = await caches.match(request);
    if (exact) return exact;
    // A failed RSC request makes Next.js fall back to a full page load,
    // which is then answered from the cached HTML below.
    if (isRsc) return Response.error();
    for (const c of [url.pathname, url.pathname.replace(/\/$/, "") || "/"]) {
      const hit = await caches.match(c, { ignoreSearch: true });
      if (hit) return hit;
    }
    if (request.mode === "navigate") {
      return new Response(
        "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"font-family:system-ui;padding:2rem\"><h1>Brak połączenia</h1><p>Ta strona nie jest zapisana offline. Otwórz ją raz z działającym serwerem albo użyj przycisku „Zapisz do użytku offline” na stronie auta.</p><p><a href=\"/\">Wróć do profilu</a></p>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    throw err;
  }
}

const NEVER_CACHE = ["/api/system", "/api/jobs", "/api/cars"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith("/media/")) {
    event.respondWith(staleWhileRevalidate(event));
  } else if (!url.pathname.startsWith("/_next/")) {
    event.respondWith(networkFirst(request));
  }
});
