# Offline support

Goal: the whole user session is local, and once a car has been opened its manuals work with
no connection at all. A connection to the app server is only needed to add cars (PDF import)
and to refresh the list of available cars, because both change on the server.

A small custom service worker (`public/sw.js`, no dependencies) and a client module
(`src/lib/offline.ts`) implement this. The app is served by a local Next.js server, so there
is no build-time precache manifest.

## Registration

`ClientEffects` registers `/sw.js` only when `NODE_ENV === "production"` (`pnpm build` +
`pnpm start`), never in `next dev`. The automatic car copy (below) is also production-only.
Cache API needs a secure context (`localhost` or HTTPS); on plain-HTTP LAN addresses
`offlineSupported()` is false and the UI says so.

## Caches

| Cache                            | Filled by                                               |
| -------------------------------- | ------------------------------------------------------- |
| `opel-cascada-manual-runtime-v3` | the service worker (app shell, visited pages, assets)   |
| `opel-cascada-manual-offline-v7` | `saveCarOffline()` — every page/image/script of one car |

`install` fetches the install metadata (`/manifest.webmanifest` and the 192/512/maskable
icons, so the installed app starts offline) and the app shell (`SHELL`: `/`, `/auta`,
`/notatnik`, `/komentarze`, `/zakladki`, `/przypomnienia`, `/ustawienia`, `/dodaj-auto`), scans each HTML for `/_next/static/*` URLs (HTML
and the inline RSC payload) and pre-caches those scripts/styles too, so every shell page
hydrates offline even if it was never visited. Then `skipWaiting()`. `activate` deletes
other `opel-cascada-manual-*` caches and claims clients. Bump the cache name when the
strategy changes. Offline cache/status namespaces follow `SCHEMA_VERSION`; update the
literal worker cache name with a schema change. Cache lookups use only the current runtime
and offline caches, never obsolete caches left or recreated by an older tab. This prevents
old offline bundles from loading and resetting a newer browser profile.
After a schema upgrade, opening each car while connected prepares its new offline copy;
old copies/statuses are not reported as usable.

## Fetch strategy (same-origin GET only)

- `/_next/static/*` — cache first (content-hashed files).
- `/media/*` (manual illustrations) — stale-while-revalidate.
- `/api/system`, `/api/jobs/*`, `/api/cars*` — never intercepted (live status, mutations).
- everything else (pages, RSC payloads, `/api/search-index`) — network first, cached copy on
  failure. Failed RSC requests return `Response.error()` so Next.js falls back to a full page
  load, which is then served from the cached HTML (`ignoreSearch`, with/without trailing
  slash). Uncached navigations get a small Polish offline page (HTTP 503).

## Automatic car copy (`src/lib/offline.ts`)

- `ActiveCarTracker` (rendered by `src/app/auto/[car]/layout.tsx`) marks the car as active
  and, 1.5 s after hydration and only when `navigator.onLine`, calls `saveCarOffline(car)`.
- `saveCarOffline` fetches `GET /api/cars/<car>/offline` → `{ version, urls }`. `urls` are
  the car page, its equipment page (`/auto/<car>/wyposazenie`), the "Lampki kontrolne" and
  "Dane techniczne" pages (`/auto/<car>/lampki-kontrolne`, `/auto/<car>/dane-techniczne`), all book, section and image
  URLs (`getCarUrls`) plus `/api/search-index?car=<car>` and the brand logo `/logo/<car>`
  when one is known (`docs/logos.md`);
  `version` (`getCarVersion` in `src/lib/content.ts`) hashes size + mtime of `car.json` and
  every book JSON plus `.next/BUILD_ID`, so it changes on re-import, re-extraction and app
  rebuilds.
- If the stored status has the same version and the first URL is cached, nothing is
  downloaded. Otherwise three workers fetch every URL into `opel-cascada-manual-offline-v7`;
  HTML responses are scanned for `/_next/static/*` assets, which are queued as best-effort
  extras (their failures do not count).
- Status lives in localStorage key `opel-cascada-manual:offline:v7`
  (`Record<car, { version, savedAt, total }>`), separate from the versioned app data. It is
  written only when every manifest URL succeeded; otherwise an error is shown and the next
  visit retries. One job per car at a time.
- UI: the car page's side-column tile "Bez internetu" (`CarActions`, `#bez-internetu`) shows progress, "Gotowe" with the
  date, errors and a "Zapisz ponownie" button (`force: true`). Car cards show an "Offline"
  badge; the car page number strip shows the same state.
  `useOnline()` drives the "Bez internetu" badge in the header, the notice on the car list and the
  "Brak połączenia" message in the add-car wizard.
- Deleting a car calls `forgetCarOffline(car)` (removes its status and cached
  `/auto/<car>…`, `/media/<car>/…` and search-index entries).

## Clearing

Settings → "Usuń instrukcje zapisane offline" deletes all `opel-cascada-manual*` caches and
calls `resetOfflineStatus()`. The active car is saved again on its next visit. User data in
the `opel-cascada-manual` localStorage key is not affected.
