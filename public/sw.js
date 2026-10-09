/*
 * Offline support (custom service worker, no external libraries).
 *
 * The app is served by a local Next.js server, so pages are cached at
 * runtime:
 * - `/_next/static/*`: cache-first (file names are content hashed);
 * - `/media/*` (manual illustrations): stale-while-revalidate;
 * - pages and the search index: network-first with a cached fallback;
 * - the app shell (SHELL) and its scripts/styles are pre-cached on install.
 * Opening a car fills OFFLINE_CACHE with every page, image and script of
 * that car in the background (see src/lib/offline.ts).
 * Mutating and status API routes are never cached.
 */
/* global self, caches, fetch, URL, Response */

const PREFIX = "opel-cascada-manual-";
const CACHE = `${PREFIX}runtime-v2`;
const OFFLINE_CACHE = `${PREFIX}offline-v1`;
const SHELL = [
  "/",
  "/auta",
  "/notatnik",
  "/komentarze",
  "/zakladki",
  "/przypomnienia",
  "/ustawienia",
  "/dodaj-auto",
];

// Scripts and styles referenced by a page (HTML and RSC payload).
const STATIC_ASSET = /\/_next\/static\/[\w\-./~]+/g;

// Pre-caches the app shell pages together with the scripts and styles they
// reference, so every shell page also works offline before it was visited.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const assets = new Set();
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-cache" });
            if (!res.ok || res.redirected) return;
            const html = await res.clone().text();
            for (const [asset] of html.matchAll(STATIC_ASSET)) assets.add(asset);
            await cache.put(url, res);
          } catch {
            // cached on first use instead
          }
        }),
      );
      await Promise.all(
        [...assets].map(async (url) => {
          try {
            if (await caches.match(url)) return;
            const res = await fetch(url);
            if (res.ok) await cache.put(url, res);
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
        "<!doctype html><meta charset=utf-8><title>Brak internetu</title><body style=\"font-family:system-ui;padding:2rem\"><h1>Brak połączenia</h1><p>Ta strona nie została jeszcze zapisana na tym urządzeniu. Otwórz ją ponownie, gdy połączenie wróci – instrukcje wybranego auta zapisują się same, aby działały bez internetu.</p><p><a href=\"/\">Wróć do profilu</a></p>",
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
