# Brand logos

When a car is active, the header (and the car page) shows the official logo of the car's
brand **as used in the car's model year** instead of the app icon (`src/components/Logo.tsx`,
still used without a car and as the fallback).

## Source

Wikidata property P154 ("logo image") of the brand, with the qualifiers P580 / P582 (start /
end time). Many brands list their former logos with years, e.g. Opel: 2009–2017, 2017–2021,
2021–2023, 2023–. Images are Wikimedia Commons files, downloaded as a raster render
(`Special:FilePath/<file>?width=400`, SVGs come back as PNG). Like the car catalogue
(`docs/catalog.md`), only the local server talks to Wikimedia (with a descriptive
`User-Agent`); the browser loads `/logo/<car>`.

## Selection (`src/lib/logos.ts`, unit-tested)

- `logoCandidates(hits, brand)` — `wbsearchentities` hits (limit 50) whose description says
  car company/marque (not a model, series, team, …) and whose label starts with the brand
  name (`catalogKey`, so "Skoda" = "Škoda Auto") or whose alias equals it; current companies
  before "former"/"defunct" ones. The first candidate (max. 5) with P154 claims wins.
- `pickLogo(logos, year)` — among logos whose period covers the year, the most recently
  introduced (the year of a change gets the new logo); undated logos cover every year.
  Dated claims count whatever their rank (some brands mark former logos "deprecated");
  undated deprecated ones are ignored. Same period: SVG/PNG before JPEG (JPEGs are often
  photos of a badge or a car), then rank. No covering logo → the current (undated end,
  non-deprecated) logo, i.e. the newest one.

## Server (`src/lib/server/logos.ts`, `src/app/logo/[car]/route.ts`)

- `getCarLogo(car)` → `{ data, type } | null` for `car.brand` + `car.year`.
- Cache in `database/.logos/` (git-ignored with `database/`): `brand-<key>.json` (entity +
  logo list; TTL 30 days when found, 7 days when not found, 1 hour after an error; a stale
  copy is used while Wikimedia is unreachable; `CACHE_VERSION`) and `<sha1(file)>.<ext>`
  images (kept forever). Failed downloads are retried after an hour (in memory). Only PNG,
  JPEG, GIF and WebP are stored and served, checked by magic bytes, max 2 MB — never SVG.
- `GET /logo/<car>` → the image (`Cache-Control: max-age=86400`) or 404.
- `/api/cars/<car>/offline` resolves the logo first and lists `/logo/<car>` only when it
  exists, so a brand without a logo does not count as a failed offline item.

## UI (`src/components/CarLogo.tsx`)

`<img src="/logo/<car>">` at a fixed height (34 px in the header, 64 px on the car page,
width up to 3.5× the height for wordmarks); on error — including an error before hydration —
it falls back to the app icon. Logos keep their original colours: like manual
illustrations they are content, the palette rule applies to the UI chrome.

Wikidata may lack a dated logo for some years (then the newest is shown) or contain odd
files; such data can be corrected on Wikidata and is picked up within 30 days (or delete
`database/.logos/brand-<key>.json`).
