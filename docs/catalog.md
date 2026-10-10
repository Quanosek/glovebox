# Car catalogue (wizard brand / model / year / engine)

The "Dodaj auto" wizard offers brands and models from official registration data. It lists
observed registration/model years and, for models with EU registrations in the latest or
previous calendar year, also includes model years through next year. This lets owners add a
new manual before registration data for that model year is published; the year is still
validated against the same model catalogue. "Inny rocznik" lets owners keep a selected brand
and model but choose an unlisted year within the importer's supported range (1950 through
next year). This is an explicit manual entry: the wizard sends display names with
`source=other`, not catalogue ids, and no catalogue provenance or engine data is inferred
for that year. Changing brand or model resets this choice; selecting a listed year returns
to catalogue validation. "Inna (wpiszę ręcznie)" is the escape hatch for
vehicles absent from the catalogue: brand, model and year are then typed/selected by hand and
still required.

## Sources

Both are public, need no API key and are queried **only by the local server** (never by
the browser), only when someone opens the wizard. No user data is sent.

- **EEA — CO2 emissions from new passenger cars** (Regulation (EU) 2019/631), DISCODATA SQL
  API `https://discodata.eea.europa.eu/sql`. Every new passenger car registered in the EU
  since 2010 (make, commercial name, year, fuel, engine size, power, registrations). The main
  table is `[CO2Emission].[latest].[co2cars]`; from 2023 years are also published as
  separate tables (`co2cars_<year><F|P>v<n>`), discovered and cached (`tables`).
- **NHTSA vPIC** `https://vpic.nhtsa.dot.gov/api/vehicles` — makes and models per model year
  sold in the USA since 2000 (types car + MPV), the other main source of cars imported to
  Poland. vPIC blocks bursts of requests (HTTP 403): at most 3 parallel requests, and after
  a 403 / 429 further vPIC calls pause for an hour (the result is cached as partial).

## Server (`src/lib/server/catalog.ts`)

- `getCatalogBrands()`, `getCatalogModels(brand)`, `getCatalogEngines(brand, model, year)`,
  `resolveCatalogCar({ brand, model, year })` (used by the importer to validate a
  `source=catalog` request), `CatalogUnavailableError` → 503.
- Cache: JSON files in `database/.catalog/` (git-ignored with `database/`). TTL: tables and
  brands 7 days, models 14, engines 30, partial results 1 hour. When a source is down, a
  stale file is used; with no file the API answers 503 and the wizard offers only "Inna".
  Concurrent requests for the same key share one fetch. Bump `CACHE_VERSION` whenever the
  normalisation changes.
- Thresholds (drop noise from the raw data): brands need ≥ 1000 EU registrations or US
  models; models need a share of the brand's registrations (clamped 20–1000) or US model
  years; a model year needs ≥ 10 registrations and ≥ 1 % of the model's peak year. The 30
  brands with most EU registrations are "Popularne"; US-only makers are listed separately and
  replica/kit/coach builders are excluded.

## Normalisation (`src/lib/catalog.ts`, client-safe, unit-tested)

`catalogKey` (upper case, no diacritics/punctuation), `brandKey` + `BRAND_ALIASES` /
`NOT_BRANDS` (merges "MERCEDES-BENZ" spellings, drops importers and "OTHER"),
`createBrandResolver` (merges typos into the much bigger spelling, `TYPO_RATIO`),
`brandName` (display name, strips legal forms), `fixMojibake`, `smartCase`, `modelFamily`
(groups commercial names into model families), `fuelKind`, `engineId` / `engineLabel`
(e.g. `diesel-2000-125` → "2,0 diesel · 125 kW (170 KM)"). Vauxhall models are shared with
Opel (`SAME_MODELS`).

## API

| Route                                          | Response                                                     |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `GET /api/catalog/brands`                      | `{ brands: CatalogBrand[] }`                                 |
| `GET /api/catalog/models?brand=`               | `{ models: CatalogModel[] }`                                 |
| `GET /api/catalog/engines?brand=&model=&year=` | `{ engines: CatalogEngine[] }` (equipment selector fallback) |

Errors: `{ error }` (Polish) with 404 (unknown brand/model) or 503 (catalogue unavailable).
The wizard does not ask for an engine. Engine variants are read from the manual and the
owner selects one later in the equipment editor; if the manual has no complete variants,
the official engine list is a fallback. The chosen engine is stored in browser `settings.engines[carId]`
(`fuel`, `engineCm3`, `powerKw`, `label`, optional manual `code`) and drives
`suggestFromSpec`. The importer validates only brand/model/year and never writes engine
choices to `car.json`. Existing shared `spec` values remain read-only compatibility hints,
transferred once for cars already owned by the browser profile. Equipment editing prefers
engine variants read from the manuals; catalogue variants are a fallback. The equipment list
groups fuel types, sorts size/power ascending and displays KM first, with kW in parentheses.

## Limits

EU data starts with 2010 registrations and US data with model year 2000. Missing years
do not prove that a model was not produced: owners of older cars can select "Inny rocznik"
(e.g. Seat Ibiza 2008). Missing brands/models and very rare models go through "Inna". Upcoming years added for
recent EU models are selectable even though engine details are not yet available for those
years. The equipment editor's fallback engine list shows EU variants only (US data has no
engine details).
