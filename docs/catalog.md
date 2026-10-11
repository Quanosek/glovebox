# Car catalogue (wizard brand / model / year / engine)

The "Dodaj auto" wizard offers brands and models from official registration data. It lists
observed registration/model years and, for models with EU registrations in the latest or
previous calendar year, also includes model years through next year. This lets owners add a
new manual before registration data for that model year is published; the year is still
validated against the same model catalogue. "Inny rocznik" lets owners keep a selected brand
and model but choose an unlisted year within the importer's supported range (1950 through
next year). Choosing it replaces the year list with a numeric input, not another dropdown.
Entering a listed year restores the list on blur and uses catalogue validation; an unlisted
year sends display names with `source=other`, not catalogue ids, and no catalogue provenance
or engine data is inferred for that year. Submission checks the entered year against the
list even if blur has not run. Changing brand or model resets this choice.
"Inna (wpiszę ręcznie)" is the escape hatch for
vehicles absent from the catalogue: brand, model and year are then typed/selected by hand and
still required.

## Sources

Both are public, need no API key and are queried **only by the local server** (never by
the browser), during initialization or catalogue use. No user data is sent.

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
  brands 7 days, models 14, engines 30, partial results 1 hour. Expired last-good data is
  returned immediately while one background request refreshes it; failed refreshes pause
  for an hour, without renewing the old timestamp. With no file the request waits for a
  fetch; if that fails, the API answers 503 and the wizard offers only "Inna".
  Cache envelopes, timestamps and values are validated. Atomic rename publishes complete
  files only; invalid or partial responses cannot replace a valid snapshot. Concurrent
  requests for the same database/key share one fetch. Bump `CACHE_VERSION` whenever the
  normalisation changes.
- EEA raw make (`Mk`) and commercial-name (`Cn`) fields may be null, empty or whitespace.
  These are missing source names, not malformed responses: brand/model normalisation skips
  them while retaining usable rows. Non-string names, missing selected fields, invalid years
  and non-integer/negative registration counts still reject the response. Blank output names
  remain invalid cache values. An empty model list is accepted only when validated EU
  rows account for exactly the brand's known positive registration count but no model
  survives normalisation or the existing thresholds (`emptyVerified`). Zero rows and
  incomplete coverage are not proof of an empty catalogue. Even a verified empty refresh
  cannot replace previously known models or renew their timestamp.
- Thresholds (drop noise from the raw data): brands need ≥ 1000 EU registrations or US
  models; models need a share of the brand's registrations (clamped 20–1000) or US model
  years; a model year needs ≥ 10 registrations and ≥ 1 % of the model's peak year. The 30
  brands with most EU registrations are "Popularne"; US-only makers are listed separately and
  replica/kit/coach builders are excluded.

## Initialization (`pnpm initial`)

After `pnpm install`, run `pnpm initial` once before starting the app. The command uses the
installed TypeScript compiler and Node's loader API, without another runner dependency.
It creates only `.catalog/` and `.logos/` under `getDatabaseDir()` (including
`MANUALS_DATABASE_DIR`), preserving existing files and never adding cars, manuals or
sample content. It prepares table discovery, brands, each European brand's models and
observed registration years, and Wikidata logo metadata. It does not fetch engines or
logo images. Existing fresh files are reused; expired files are refreshed with a wait,
retaining last-good data if a source is unavailable.

Model preparation runs two brands at a time; EEA requests share a three-request limit
across table discovery and model queries. Discovery still probes the existing versioned
EEA table names, so a first run can take several minutes. No network sweep is performed
on every app startup.

The ordinary brand list includes optional vPIC make metadata (two requests), but bulk
initialization deliberately does **not** scan every US make/year: that would require
thousands of requests and hit vPIC rate limits. `models-eu-<brand>.json` holds the prepared
European data. The wizard serves it immediately while enriching the selected brand into
the normal `models-<brand>.json` cache through the existing EU/vPIC loader. Engines and
US-only models remain lazy. Failed/partial enrichment preserves the European fallback.
Both caches expire normally: they are not permanent initial snapshots. Opening the wizard's
brand list schedules bounded background preparation of all European model/year caches and
logo metadata, at most once an hour per process; the API response never waits for this
preparation. Fresh files need no network requests. Official-source corrections therefore
appear during runtime use after expiry, without rerunning initialization.

EEA registration years are not a complete manufacturer production calendar: rare cars,
older models and years before 2010 may be absent. Existing thresholds and manual-entry
options still apply. A first offline run cannot invent official lists; the command leaves
the empty layout intact and reports failure so it can be rerun with a connection.
Failures preparing models still produce a nonzero exit status. Optional logo failures
instead produce a bounded warning with the source, HTTP status or connection/response
problem and retry guidance; a usable catalogue is not failed just because Wikidata is
unavailable. A successful lookup without a logo is not reported as a request failure.

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
