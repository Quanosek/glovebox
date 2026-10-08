# Offline support

A small custom service worker (`public/sw.js`, no dependencies) keeps visited pages and
images available without a network. The app is served by a local Next.js server, so there is
no precache manifest; caching happens at runtime.

## Registration

`ClientEffects` registers `/sw.js` only when `NODE_ENV === "production"` (`npm run build` +
`npm start`), never in `next dev`.

## Caches

| Cache                            | Filled by                                   |
| -------------------------------- | ------------------------------------------- |
| `opel-cascada-manual-runtime-v2` | the service worker (visited pages, assets)  |
| `opel-cascada-manual-offline-v1` | "Zapisz do użytku offline" on `/auto/<car>` |

`install` caches the app shell (`/`, `/auta`, `/notatnik`, `/komentarze`, `/zakladki`,
`/ustawienia`, best effort) and calls `skipWaiting()`. `activate` deletes other
`opel-cascada-manual-*` caches and claims clients. Bump the cache name when the strategy
changes.

## Fetch strategy (same-origin GET only)

- `/_next/static/*` — cache first (content-hashed files).
- `/media/*` (manual illustrations) — stale-while-revalidate.
- `/api/system`, `/api/jobs/*`, `/api/cars*` — never intercepted (live status, mutations).
- everything else (pages, RSC payloads, `/api/search-index`) — network first, cached copy on
  failure. Failed RSC requests return `Response.error()` so Next.js falls back to a full page
  load, which is then served from the cached HTML (`ignoreSearch`, with/without trailing
  slash). Uncached navigations get a small Polish offline page (HTTP 503).

## "Zapisz do użytku offline"

`CarActions` fetches `GET /api/cars/<car>/offline` (all book, section and image URLs from
`getCarUrls`) and stores them in `opel-cascada-manual-offline-v1` with four parallel workers,
showing progress. `caches.match` searches every cache, so the worker finds these entries.

## Clearing

Settings → "Wyczyść pamięć offline" deletes all `opel-cascada-manual*` caches. User data in
localStorage is not affected.
