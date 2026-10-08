# Offline support

A small custom service worker (`public/sw.js`, no dependencies) makes the production build
work offline after the first load, including all images.

## Build step

`npm run build` = `next build` (static export to `out/`) + `scripts/generate-precache.mjs`,
which walks `out/`, maps files to the URLs they are served under (clean URLs:
`x.html` → `/x`, `index.html` → `/`) and replaces the `self.__PRECACHE_MANIFEST` placeholder
in `out/sw.js` with `{ version, urls }`. The version is a hash of all files, so every content
or code change yields a new worker.

## Runtime

- Registered by `ClientEffects` only when `NODE_ENV === "production"` (never in `next dev`).
- `install`: downloads every URL into cache `opel-cascada-manual-<version>` in batches of 20
  (single failures are ignored), then `skipWaiting()`.
- `activate`: deletes older `opel-cascada-manual-*` caches, `clients.claim()`.
- `fetch` (same-origin GET only):
  - `/_next/static/*` and `/assets/*` — cache first (immutable files);
  - everything else (HTML, RSC payload `.txt`, `search-index.json`) — network first, falling
    back to the cache (`ignoreSearch`, also without trailing slash), then `/404`, then a
    plain-text 503 message for navigations.

## Hosting requirements

The exported site must be served with clean URLs (`/instrukcja` → `instrukcja.html`), as
`npm start` (`serve out`) does. Serving `out/` with a server without clean URLs breaks deep
links and the precache.

## Clearing

Settings → "Wyczyść pamięć offline" deletes the caches; they are rebuilt on the next load.
User data in localStorage is not affected.
