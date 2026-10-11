# Brand logos

When a car is active, the header (and the car page) shows the official logo of the car's
brand **as used in the car's model year** instead of the Glovebox app mark (`src/components/Logo.tsx`,
still used without a car and as the fallback).

## Source

Wikidata property P154 ("logo image") of the brand, with the qualifiers P580 / P582 (start /
end time). A logo dated only with P585 (point in time, e.g. Opel's 1970 and 1987 logos) is
treated as known for that single year. Many brands list their former logos with years, e.g. Opel: 2009–2017, 2017–2021,
2021–2023, 2023–. Images are Wikimedia Commons files, downloaded as a raster render
(`Special:FilePath/<file>?width=400`, SVGs come back as PNG). Like the car catalogue
(`docs/catalog.md`), only the local server talks to Wikimedia (with a descriptive
`User-Agent`); the browser loads `/logo/<car>`.

The result is only as good as the brand's Wikidata entry. Some entries list a single
undated logo (SEAT, Q188217, only has the current "SEAT S.A." company logo), which is then
shown for every model year; adding dated P154 values on Wikidata fixes this for all users.

## Rate limits

Wikidata answers bursts of anonymous requests with HTTP 429. Metadata requests are spaced
(`WIKIDATA_PACING`, 250 ms; at most two lookups in flight); an HTTP 429 or 503 pauses all
lookups for its `Retry-After` (else 1 s, 2 s, …; max 15 s) and the request is retried up to
three times before the brand counts as failed.

## Selection (`src/lib/logos.ts`, unit-tested)

- `logoCandidates(hits, brand)` — `wbsearchentities` hits (limit 50) whose description says
  car company/marque (not a model, series, team, …) and whose label starts with the brand
  name (`catalogKey`, so "Skoda" = "Škoda Auto") or whose alias equals it; current companies
  before "former"/"defunct" ones. The first candidate (max. 5) with P154 claims wins.
- `pickLogo(logos, year)`:
  1. dated logos whose period covers the year → the most recently introduced (the year of a
     change gets the new logo);
  2. a year older than every dated logo → the oldest dated logo (the closest known design;
     e.g. a 2005 Opel gets the 2009–2017 logo, not today's);
  3. otherwise an undated non-deprecated logo (usually the current one), else the dated logo
     whose period is nearest (newer on a tie).
     Dated claims count whatever their rank (some brands mark former logos "deprecated");
     undated deprecated ones are ignored. Same period: SVG/PNG before JPEG (JPEGs are often
     photos of a badge or a car), then rank.

## Server (`src/lib/server/logos.ts`, `src/app/logo/[car]/route.ts`)

- `getCarLogo(car)` → `{ data, type } | null` for `car.brand` + `car.year`.
- Cache in `database/.logos/` (git-ignored with `database/`): `brand-<key>.json` (entity +
  logo list; TTL 30 days when found, 7 days when not found, 1 hour after an error; a stale
  copy is returned immediately while a background request refreshes it; a cached entry
  without any logo is never served stale — the request waits for the lookup instead; `CACHE_VERSION`,
  only format version 1 is accepted; mismatched formats are refreshed before use) and `<sha1(file)>.<ext>`
  images (kept forever). Failed downloads are retried after an hour (in memory). Only PNG,
  JPEG, GIF and WebP are stored and served, checked by magic bytes, max 2 MB — never SVG.
- A failure recorded by another process (typically a rate-limited `pnpm initial`) does not
  block `/logo/<car>`: the server retries once and then keeps its own hourly back-off.
- `pnpm initial` prewarms metadata for European brands from the official EEA catalogue,
  with at most two concurrent brand lookups. It respects `MANUALS_DATABASE_DIR`, reuses
  fresh metadata and waits for expired lookups to refresh; it does not download images.
  Wikidata is community-maintained metadata, not an official manufacturer catalogue.
  Missing entries are cached for seven days and may fall back to the app mark.
  Request failures are distinct from successful lookups without a logo. Initialization
  reports the failed count and at most three diagnostic reasons (Wikidata HTTP status,
  timeout, connection or malformed-response failure), not every brand's name. Logos are
  optional: these warnings do not change the command's exit status when the catalogue
  is usable. Check DNS/proxy access to `www.wikidata.org` or HTTP 403/429 restrictions;
  failed metadata is retried after an hour. Failed first-lookups retain their diagnostic
  in the short-lived cache; a failed refresh never overwrites last-good metadata.
- Metadata is rechecked on runtime use even when an image is already cached. Corrected
  Commons file references therefore replace the selected logo after metadata expiry;
  image caching never freezes the brand's logo list. Future/invalid timestamps and
  malformed cached entries are ignored. Atomic writes prevent truncated snapshots.
  Failed, malformed or empty refreshes never erase a last-good logo list or renew its
  timestamp; retries are paused for an hour. Other brands keep their independent TTLs.
- `GET /logo/<car>` → the image (`Cache-Control: max-age=86400`) or 404 (`no-store`, so a
  temporary miss is never cached by the browser).
- `/api/cars/<car>/offline` resolves the logo first and lists `/logo/<car>` only when it
  exists, so a brand without a logo does not count as a failed offline item.

## UI (`src/components/CarLogo.tsx`)

`<img src="/logo/<car>">` at a fixed height in the header (34 px, width up to 3.5× the
height for wordmarks). The width is known before the image loads: `getCarSummary` adds
`logo: { width, height }` read from the header of the cached image (`cachedLogoSize` in
`src/lib/server/logoSize.ts`, disk only, PNG/JPEG/GIF/WebP), so the brand name next to it
never moves; an unknown logo reserves the app icon's square; on the car page it fills (`fill`, `object-contain`) the square
`.car-hero-logo` frame (6.5rem) inside a fixed 0.875rem safe margin, so wide wordmarks and
square badges never touch the frame; on error — including an error before hydration —
it falls back to the app icon. Logos keep their original colours: like manual
illustrations they are content, the palette rule applies to the UI chrome.

Wikidata may lack a dated logo for some years (then the newest is shown) or contain odd
files; such data can be corrected on Wikidata and is picked up within 30 days (or delete
`database/.logos/brand-<key>.json`).
