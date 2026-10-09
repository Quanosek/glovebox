<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — car-manual-library

Private, local-only Next.js app for reading vehicle manuals from any manufacturer, with
highlighting, comments, bookmarks and a Markdown notebook. The visual hierarchy takes
inspiration from Opel's Navi 950 interface; the vehicle database itself is generic and user
populated. There is no bundled example, default vehicle, manual template or generated content.
Users assign readable cars from `database/` to their browser profile or add cars from PDF manuals
with a step-by-step wizard, then can mark optional equipment.

- **No accounts, no database server.** On entry the user sees a local profile (`/`): car
  assignments or notebook. User data lives in the browser only (localStorage + Cache API).
- **Manual content is a local file database** (`database/`, **git-ignored**), served by the
  local Next.js server (`next dev` / `next start`). Nothing inside it is committed. Cars in the
  library are not automatically assigned to the browser profile; users can add a library car or
  import their own. A fresh checkout starts without manuals.
- **Offline after a car is chosen.** Opening a car saves all its pages, images and scripts
  to the Cache API in the background; from then on it works with no connection. A
  connection is only needed to add cars and to refresh the car list (`docs/offline.md`).
- **Installation checks.** The add-car wizard validates the supported Node and Python versions,
  PyMuPDF/Pillow, extractor availability, database write access, local access and active import
  jobs. It reports whether manuals already exist but does not require them to import the first car.
- **Non-technical users.** UI text is plain Polish without jargon (no paths, commands, file
  formats, "serwer", "JSON", "localStorage" …); technical details belong in `README.md` /
  `docs/` (`docs/ui.md`).
- No analytics and no third-party calls from the browser — keep it that way. The only
  outbound requests are made by the local server: the official car catalogues used by the
  wizard (EEA CO2 data, NHTSA vPIC; cached in `database/.catalog/`, `docs/catalog.md`) and
  brand logos from Wikidata / Wikimedia Commons (cached in `database/.logos/`,
  `docs/logos.md`); public, no keys, no user data sent. PDFs never stay on disk.

## Language rules (strict)

| What                                                                        | Language    |
| --------------------------------------------------------------------------- | ----------- |
| Code, identifiers, code comments, commit messages, `AGENTS.md`, `docs/*.md` | **English** |
| UI text, page content, manual content, root `README.md`, user-facing errors | **Polish**  |

## First session and commands

pnpm is the only package manager (`pnpm-lock.yaml`; `pnpm-workspace.yaml` allow-lists
dependency build scripts). Do not add `package-lock.json` / `yarn.lock`.
Read the Polish user setup in `README.md` before changing onboarding or import behavior. A
fresh clone has no car content: install dependencies, prepare Python as described there, start
the app, and add the first car through `/dodaj-auto`. Never create or commit files under
`database/`; `.gitignore` excludes user manuals, import staging data and local catalogue/logo
caches. Check `git status --ignored` carefully before modifying local database content.

```bash
pnpm install           # install from pnpm-lock.yaml (CI: --frozen-lockfile)
pnpm dev               # dev server (service worker + automatic offline copies disabled)
pnpm build             # next build (server output in .next/)
pnpm start             # next start on :3000 (needed for database/ and the import wizard)
pnpm lint              # ESLint (flat config: next core-web-vitals + typescript)
pnpm typecheck         # next typegen && tsc --noEmit
pnpm test              # Vitest (src/**/*.test.ts)
pnpm format            # Prettier (+ Tailwind class sorting); `pnpm format:check` only checks
pnpm test:extract      # Python unittest for scripts/extract.py (needs supported Python/PyMuPDF/Pillow)
pnpm icons             # src/app/icon.svg -> apple-icon.png + favicon.ico
```

The importer finds Python via `PYTHON`, then `.venv/bin/python` / `.venv\Scripts\python.exe`,
then `python3`, `python`, `py`; it accepts Python 3.10+, PyMuPDF 1.26+ and Pillow 12.3+
(`src/lib/server/python.ts`, `scripts/requirements.txt`).

## Architecture

```
database/                       user-managed manual content (git-ignored; JSON + WebP, never PDFs)
  <car>/car.json                CarFile: brand, model, year, variant?, catalog?, spec?, books[]
  <car>/<bookId>/index.json     BookIndex (+ one ChapterFile JSON per top-level chapter)
  <car>/assets/<bookId>/<chapter>/p<page>-<n>.webp   illustrations, served as /media/<car>/...
  .import-<job>/                staging folder of a running import (skipped)
  .catalog/                     cached official catalogue answers (docs/catalog.md)
  .logos/                       cached brand logos (docs/logos.md)
scripts/                        generic PDF extraction (Python), tests, icon generator
  extract.py                    PDF -> JSON blocks + WebP images (PyMuPDF, Pillow)
public/sw.js                    service worker (shell precache + runtime caching, docs/offline.md)
src/
  app/
    page.tsx                    profile (ProfileView): assigned cars / notebook / continue reading,
                                reading history, recent highlights, "Czy wiesz, że…" tips
    auta/                       car list (CarPicker)
    auto/[car]/                 car "home screen" (docs/car-overview.md): car card, numbers,
                                favourites, quick tiles, books, tools, technical-data preview,
                                service reminders, offline status; layout tracks active car
    auto/[car]/lampki-kontrolne/  symbols glossary (icons + explanation from the manuals)
    auto/[car]/dane-techniczne/   technical data cards (tables of technical chapters)
    auto/[car]/wyposazenie/     per-car equipment editor (EquipmentEditor)
    auto/[car]/[book]/          book index + sidebar layout; [...slug]/ section pages
    dodaj-auto/                 add library car or import wizard (car + PDFs, reading, equipment)
    api/system                  GET environment + manual count check (Node, Python, database)
    api/cars                    GET list · POST multipart import (202 {job})
    api/cars/[car]              GET · DELETE (not while importing)
    api/cars/[car]/offline      GET { version, urls } for the offline copy of a car
    api/cars/[car]/features     GET { sections, spec } equipment found in the car's manuals
    api/catalog/{brands,models,engines}   GET official catalogue lists (wizard)
    api/jobs/[id]               GET import progress
    api/search-index?car=       GET search corpus of one car
    media/[...path]             GET images from database/<car>/assets (webp/png/jpg only)
    logo/[car]                  GET brand logo of the car's model year (404 = app icon)
    przypomnienia/              reminders per car of the profile (inspection, OC, own)
    szukaj, ostrzezenia, komentarze, zakladki, notatnik, ustawienia
  components/                   UI (server: BlockRenderer; the rest are client components)
  components/Dialog.tsx         confirmDialog()/alertDialog() + DialogHost (root layout)
  components/EquipmentEditor.tsx  per-car equipment checklist (wizard + equipment page)
  components/CarLogo.tsx        brand logo of the active car (header, car page), falls back to Logo
  components/Header.tsx         header, main navigation (due reminders badge) and Navi-like clock
  components/reminders/         /przypomnienia: inspection, OC insurance, own reminders per car
  components/car/               car overview parts (CarHero, CarStatsStrip, QuickTiles, ...)
  components/profile/, reader/  profile activity/tips, reader side column highlights
  config/quickTopics.ts         title rules for "Najczęściej potrzebne", glossary, technical data
  config/vehicle.ts             generic optional features (no defaults) + suggestFromSpec
  config/featureRules.ts        title rules tagging sections/headings of every car
  content/types.ts              content format contract
  lib/content.ts                server-only database reader (Node fs, mtime-checked cache)
  lib/carOverview.ts            server-only car overview/glossary/tech/tips collection
  lib/overview.ts               client-safe overview helpers and types (tested)
  lib/server/                   importer (jobs), official catalogue, python, cross-site guard
  lib/catalog.ts                client-safe catalogue types + name normalisation
  lib/logos.ts                  brand logo matching + year selection (pure, tested)
  lib/cars.ts, lib/slug.ts      client-safe car types/helpers and id rules
  lib/storage/                  localStorage store, schema, migrations, React hooks,
                                layout hint cookie (hint.ts, hintContext.tsx)
  lib/reminders.ts              reminder dates, due/soon rules (pure, tested)
  lib/anchoring/                text-quote/position anchoring + DOM helpers
  lib/markdown.ts               safe Markdown subset parser (notebook)
  lib/typography.ts             Polish line-breaking rules (+ typographyDom.ts client pass)
  lib/pdfPreview.ts             first-page preview with pdfjs-dist (wizard only)
  lib/offline.ts                offline car copies (Cache API), status store, useOnline()
```

- The app runs as a **local Node server**; pages are `force-dynamic` (root layout) so newly
  imported cars appear without a rebuild. `listCarSummaries()` excludes cars that have no
  readable manual; the profile and car picker show the first-car action when the library is empty.
- Content API (`src/lib/content.ts`) works on a `BookCtx { car, book }`: `getBookCtx(car,
route)`, `getBook`, `getSection`, `sectionHref`, `getTocTree`, `getPrevNext`,
  `resolvePageRef`, … plus `listCars`, `listCarSummaries`, `getAllWarnings`,
  `getSearchDocs(car)`, `getSectionFeatures`, `getFeatureTree`, `getFeatureSections(car)`,
  `getCarUrls(car)`, `getCarVersion(car)`. Override the folder with `MANUALS_DATABASE_DIR`.
- Ids: car and book ids match `ID_PATTERN` (`/^[a-z0-9][a-z0-9-]{0,79}$/`, `src/lib/slug.ts`);
  this is also what keeps `/media` and imports path-safe. Imported book ids and routes are
  slugs of their titles (`assets`, `wyposazenie`, `lampki-kontrolne` and `dane-techniczne`
  reserved, `RESERVED_BOOK_ROUTES`).
- Mutating API routes call `rejectCrossSite()` (loopback `Host` + same-origin `Origin` /
  `Sec-Fetch-Site`; `MANUALS_ALLOW_REMOTE_IMPORT=1` allows LAN hosts) because the server is
  unauthenticated; only GET routes may skip it.
- Client state comes from `useAppData()` (`useSyncExternalStore` over the store). Anything that
  depends on stored data must wait for `useHydrated()` to avoid hydration mismatches.
  `useActiveCar(cars)` resolves the current car (URL `/auto/<id>` first, then
  `settings.activeCar`).
- First paint = final layout: the `ocm-layout` cookie (`src/lib/storage/hint.ts`) mirrors a
  small summary of the browser data; the root layout reads it and `useLayoutHint()` gives
  client components the car ids, counts and "Czytaj dalej" card before hydration. Placeholders
  must match the real element boxes exactly (`docs/ui.md`, `docs/storage.md`).

## Import pipeline (wizard `/dodaj-auto`)

See `docs/import.md`. In short: multipart POST (`source=catalog` is validated against the
official catalogue, `docs/catalog.md`; `source=other` = "Inna", free text) → limits checked (10 PDFs, 250 MB each,
`%PDF-` magic) → PDFs written to an `os.tmpdir()` folder → `extract.py` per document into
`database/.import-<job>/` → `car.json` written → staging renamed to `database/<car>/`.
The temp folder is removed in `finally`, so **PDFs are deleted on success and on failure**.
One import at a time; job state lives in memory (`globalThis`) and is polled by the wizard,
which then shows the equipment step.

## Design rules (strict)

- Light, minimal UI inspired by the Opel **Navi 950** interface: thin 1px lines, silver
  gradients for headers/buttons (`.silver-bar`, `.btn`, `.panel-title`), red accents. Keep UI
  and vehicle data manufacturer-neutral; only the design inspiration and accent color refer to Opel.
- **No rounded corners anywhere.** Tailwind radius tokens are removed (`--radius-*: initial`)
  and `globals.css` forces `border-radius: 0 !important` on every element. Never add
  `rounded-*` classes or inline radii.
- **Palette only** (Tailwind theme colours, all others removed):
  `white #FFFFFF`, `paper #F4F5F6`, `line #D9DCDF`, `silver #B8BCC0`, `steel #8A8F94`,
  `graphite #5C6166`, `ink #2B2E31`, `black`, `red #C8102E`, `red-bright #E4002B`.
  No blue, green or other hues (including focus rings, links, success messages).
- Highlight palette (`src/lib/highlightColors.ts`): `light`, `silver`, `graphite`, `red`.
- System sans-serif font stack; responsive for phone, tablet and desktop. Three alignment
  levels share one side gutter (`--gutter`): the frame (`.app-frame`, `max-w-app` 90rem:
  header rows, footer, reader), page content (`.page-shell`, 72rem) and the reader text
  column (`.reader-column`, 48rem). Headings and numbers use the type scale classes
  (`.type-display`, `.page-title` / `.type-title`, `.type-card`, `.type-item`, `.type-value`,
  `.section-label`, `.panel-title`; `docs/ui.md`). Long unbroken strings must wrap inside their box
  (`overflow-wrap: anywhere` on `body`) — never let text overflow a panel or notice.
- Polish typography: no one-letter words at line ends and no lone last word in paragraphs —
  `polishTypography()` (`src/lib/typography.ts`) on the server for manual content,
  `watchTypography()` on the client for everything else. Editorial Polish (`„…”`, `–`, `…`,
  sentence case, one term per concept). Details in `docs/ui.md`.
- Favicon: generic open-book mark on white (`src/app/icon.svg`). After editing it run
  `pnpm icons`. With an active car the header and the car
  page show the official brand logo of the car's model year instead (`CarLogo`,
  `docs/logos.md`); brand logos keep their own colours (content, not UI chrome).
- **Never use native `window.confirm` / `alert` / `prompt`.** Use `confirmDialog()` /
  `alertDialog()` from `src/components/Dialog.tsx` (centred `<dialog>` over a blurred
  backdrop, Esc / backdrop click = cancel, `danger` focuses "Anuluj").
- Interaction: `.btn` fades on hover and "presses in" on `:active` (1px down + inset shadow);
  `.field` has exactly one focus cue (graphite border, no ring/underline); `.hover-tile` for
  clickable cards; everything respects `prefers-reduced-motion`. Details in `docs/ui.md`.

## Vehicle equipment & feature tagging

Details in `docs/vehicle-profile.md`. Every car is tagged; no car has preset equipment.

- `src/config/vehicle.ts` lists generic optional features (`FEATURES`: id, group, Polish
  label, optional note) — no defaults. A feature without a stored state is neutral.
- Profiles are per car in `settings.vehicles[carId]`, edited with `EquipmentEditor` on
  `/auto/<car>/wyposazenie` and in the wizard's equipment step ("Mam" / "Nie mam" / "Nie
  wiem"). Owner choices are `confirmed`; `suggestFromSpec(car.spec)` (engine from the
  catalogue) adds `probable` suggestions. Only features detected in the car's manuals are
  offered (`getFeatureSections`).
- `src/config/featureRules.ts` tags by regex on Polish **section titles** (inherited by
  sub-sections, `getSectionFeatures`) and **heading blocks** inside a section
  (`getFeatureTree`: a heading part runs to the next heading of the same or higher level).
  Rules run on the server at render time; editing them needs no re-extraction.
- `getAvailability` (`src/lib/availability.ts`): any tagged feature with status `no` ->
  `missing` ("Brak w Twoim aucie": section or heading part collapsed by `SectionGate`,
  greyed in the TOC, lists and search, filtered from the warnings index unless "Pokaż
  wszystko" is on); else `verify` / `probable` badges; else "Twoje auto". Collapsed
  content stays in the DOM (`hidden`) so anchoring and in-page links keep working.
- To add a feature: add it to `FEATURES`, add a rule in `FEATURE_RULES`, run `pnpm test`.

## Content

- Format contract: `src/content/types.ts` (`BookIndex` in `index.json`, one `ChapterFile`
  per top-level chapter). Section ids are slug paths (`chapter/sub`); block ids `b1..bN`
  per section are deep-link targets (`/auto/<car>/<book>/<slug>#b12`). Page references are
  `{ page: n }` runs resolved to links by `resolvePageRef`.
- Generated content must not be edited by hand (it is replaced by importing the source PDF
  again). The generic extractor and its tests are in `scripts/extract.py` and
  `scripts/tests/` (`docs/extraction.md`).
- A fresh checkout has an empty `database/` (the app offers adding a car). Raw PDFs are
  never committed (`manuals/`, `*.pdf`), and neither is any generated content.
- Do not create seeded/example cars or database fixtures. The wizard creates each user's
  `database/<id>/car.json` and book folders from their PDFs.

## Storage schema

Single localStorage key `opel-cascada-manual`, versioned (`SCHEMA_VERSION` in
`src/lib/storage/schema.ts`):

```ts
AppData {
  version: 5;
  highlights: Record<id, { id, car, book, sectionId, sectionTitle, href,
    anchor: { exact, prefix, suffix, start, end }, color, comment, createdAt, updatedAt }>;
  notebook: { pages: { id, title, body /* Markdown */, createdAt, updatedAt }[] }; // user order
  bookmarks: { id: `${car}:${book}:${sectionId}`, car, book, sectionId, title, href, createdAt }[];
  lastRead: { car, book, sectionId, title, href, scrollY, at } | null;
  history: { car, book, sectionId, title, href, thumb: string | null, at }[]; // newest first, ≤ 12
  reminders: { id, car, kind: "inspection" | "insurance" | "custom", title,
    dueDate: string | null, dueKm: number | null, done,
    createdAt, updatedAt }[];
  settings: { fontSize, showUnavailable, ownedCars,
    vehicles: Record<carId, Record<featureId, FeatureState>>,
    activeCar: string | null, profileName: string };
}
```

- Historical v1 → v2 and v2 → v3 migrations preserve data from the retired single-car
  application. The legacy vehicle id and routes only occur in migration code; they do not seed
  a vehicle or affect new installs.
- `settings.ownedCars` holds ids assigned to the local profile; removing one does not delete its
  manuals from `database/`.
- Changing the shape: bump `SCHEMA_VERSION`, add `MIGRATIONS[oldVersion]` in
  `migrations.ts`, extend `sanitize`, add a test in `src/lib/__tests__/storage.test.ts`.
- Export file: `{ app: "opel-cascada-manual", exportedAt, data }`. Import accepts it (or bare
  data) in `merge` (newest `updatedAt` wins per id) or `replace` mode.
- Unreadable stored data is copied to `opel-cascada-manual:backup-<timestamp>` before reset.

More detail: `docs/ui.md`, `docs/import.md`, `docs/offline.md`, `docs/storage.md`,
`docs/highlighting.md`, `docs/comments.md`, `docs/notebook.md`, `docs/extraction.md`,
`docs/vehicle-profile.md`, `docs/catalog.md`, `docs/logos.md`, `docs/car-overview.md`. Keep these files in sync with the code in the same change.

## Conventions

- TypeScript strict; Prettier (with Tailwind class sorting) and ESLint must pass.
- Never import `src/lib/content.ts` or `src/lib/server/*` (Node `fs`, `child_process`) from
  client components; pass data as props or fetch the JSON API routes.
- Every UI string is Polish; every identifier/comment English.
- Before finishing a change run:
  `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm build`.
