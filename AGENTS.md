<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — opel-cascada-manual

Private, local-only Next.js app for reading car owner manuals with highlighting, comments,
bookmarks and a Markdown notebook. It ships the full Polish content of the two official
Opel Cascada MY16 manuals (main manual + Navi 950 infotainment, personalised to the owner's
car) and lets the user add more cars from PDF files with a step-by-step wizard.

- **No accounts, no database server.** On entry the user sees a local profile (`/`): car
  picker or notebook. User data lives in the browser only (localStorage + Cache API).
- **Manual content is a file database in the repo** (`database/`), served by the local
  Next.js server (`next dev` / `next start`). Committing `database/<car>/` makes a car
  available on every device that runs the repo.
- No external API calls and no analytics — keep it that way. PDFs never stay on disk.

## Language rules (strict)

| What                                                                        | Language    |
| --------------------------------------------------------------------------- | ----------- |
| Code, identifiers, code comments, commit messages, `AGENTS.md`, `docs/*.md` | **English** |
| UI text, page content, manual content, root `README.md`, user-facing errors | **Polish**  |

## Commands

```bash
npm run dev            # dev server (service worker disabled)
npm run build          # next build (server output in .next/)
npm start              # next start on :3000 (needed for database/ and the import wizard)
npm run lint           # ESLint
npm run typecheck      # next typegen && tsc --noEmit
npm test               # Vitest (src/**/*.test.ts)
npm run test:extract   # Python unittest for scripts/extract.py (needs PyMuPDF)
npm run fetch-manuals  # download the Cascada PDFs into manuals/ (git-ignored)
npm run extract        # Cascada PDFs -> database/opel-cascada-2016/**
npm run icons          # src/app/icon.svg -> apple-icon.png + favicon.ico
```

The importer finds Python via `PYTHON`, then `.venv/bin/python` / `.venv\Scripts\python.exe`,
then `python3`, `python`, `py` (first one with PyMuPDF + Pillow wins; `src/lib/server/python.ts`).

## Architecture

```
database/                       manual content (committed; JSON + WebP, never PDFs)
  <car>/car.json                CarFile: brand, model, year, variant?, profile?, builtIn?, books[]
  <car>/<bookId>/index.json     BookIndex (+ one ChapterFile JSON per top-level chapter)
  <car>/assets/<bookId>/<chapter>/p<page>-<n>.webp   illustrations, served as /media/<car>/...
  .import-<job>/                staging folder of a running import (git-ignored, skipped)
scripts/                        extraction pipeline (Python + Node wrappers), icon generator
  extract.py                    PDF -> JSON blocks + WebP images (PyMuPDF, Pillow)
  extract.mjs / manuals.config.json   regenerates the built-in Cascada books
public/sw.js                    service worker (runtime caching, see docs/offline.md)
src/
  app/
    page.tsx                    profile (ProfileView): car choice / notebook / continue reading
    auta/                       car list (CarPicker)
    auto/[car]/                 car overview (books, offline save, delete)
    auto/[car]/[book]/          book index + sidebar layout; [...slug]/ section pages
    dodaj-auto/                 import wizard (AddCarWizard: 4 steps)
    api/system                  GET environment check (Python, PyMuPDF, Pillow, writable db)
    api/cars                    GET list · POST multipart import (202 {job})
    api/cars/[car]              GET · DELETE (not built-in, not while importing)
    api/cars/[car]/offline      GET all page + image URLs of a car
    api/jobs/[id]               GET import progress
    api/search-index?car=       GET search corpus of one car
    media/[...path]             GET images from database/<car>/assets (webp/png/jpg only)
    szukaj, ostrzezenia, komentarze, zakladki, notatnik, ustawienia, twoje-auto
  components/                   UI (server: BlockRenderer; the rest are client components)
  config/vehicle.ts             Cascada feature definitions + defaults
  config/featureRules.ts        title-based rules tagging Cascada sections with features
  config/carCatalog.ts          brand -> model suggestions for the wizard
  content/types.ts              content format contract
  lib/content.ts                server-only database reader (Node fs, mtime-checked cache)
  lib/server/                   importer (jobs), python detection, cross-site guard
  lib/cars.ts, lib/slug.ts      client-safe car types/helpers and id rules
  lib/storage/                  localStorage store, schema, migrations, React hooks
  lib/anchoring/                text-quote/position anchoring + DOM helpers
  lib/markdown.ts               safe Markdown subset parser (notebook)
  lib/pdfPreview.ts             first-page preview with pdfjs-dist (wizard only)
```

- The app runs as a **local Node server**; pages are `force-dynamic` (root layout) so newly
  imported cars appear without a rebuild. `next.config.ts` permanently redirects the old
  `/instrukcja/*` and `/navi-950/*` URLs to `/auto/opel-cascada-2016/...`.
- Content API (`src/lib/content.ts`) works on a `BookCtx { car, book }`: `getBookCtx(car,
route)`, `getBook`, `getSection`, `sectionHref`, `getTocTree`, `getPrevNext`,
  `resolvePageRef`, … plus `listCars`, `listCarSummaries`, `getAllWarnings`,
  `getSearchDocs(car)`, `getCarUrls(car)`. Override the folder with `MANUALS_DATABASE_DIR`.
- Ids: car and book ids match `ID_PATTERN` (`/^[a-z0-9][a-z0-9-]{0,79}$/`, `src/lib/slug.ts`);
  this is also what keeps `/media` and imports path-safe. Cascada keeps book ids `manual` /
  `infotainment` (routes `instrukcja` / `navi-950`); imported books use id = route = slug of
  the title.
- Mutating API routes call `rejectCrossSite()` (loopback `Host` + same-origin `Origin` /
  `Sec-Fetch-Site`; `MANUALS_ALLOW_REMOTE_IMPORT=1` allows LAN hosts) because the server is
  unauthenticated; only GET routes may skip it.
- Client state comes from `useAppData()` (`useSyncExternalStore` over the store). Anything that
  depends on stored data must wait for `useHydrated()` to avoid hydration mismatches.
  `useActiveCar(cars)` resolves the current car (URL `/auto/<id>` first, then
  `settings.activeCar`).

## Import pipeline (wizard `/dodaj-auto`)

See `docs/import.md`. In short: multipart POST → limits checked (10 PDFs, 250 MB each,
`%PDF-` magic) → PDFs written to an `os.tmpdir()` folder → `extract.py` per document into
`database/.import-<job>/` → `car.json` written → staging renamed to `database/<car>/`.
The temp folder is removed in `finally`, so **PDFs are deleted on success and on failure**.
One import at a time; job state lives in memory (`globalThis`) and is polled by the wizard.

## Design rules (strict)

- Light, minimal UI inspired by the Opel **Navi 950** screens: thin 1px lines, silver
  gradients for headers/buttons (`.silver-bar`, `.btn`, `.panel-title`), Opel red accents.
- **No rounded corners anywhere.** Tailwind radius tokens are removed (`--radius-*: initial`)
  and `globals.css` forces `border-radius: 0 !important` on every element. Never add
  `rounded-*` classes or inline radii.
- **Palette only** (Tailwind theme colours, all others removed):
  `white #FFFFFF`, `paper #F4F5F6`, `line #D9DCDF`, `silver #B8BCC0`, `steel #8A8F94`,
  `graphite #5C6166`, `ink #2B2E31`, `black`, `red #C8102E`, `red-bright #E4002B`.
  No blue, green or other hues (including focus rings, links, success messages).
- Highlight palette (`src/lib/highlightColors.ts`): `light`, `silver`, `graphite`, `red`.
- System sans-serif font stack; responsive for phone, tablet and desktop.
- Favicon: black Opel blitz in a ring on white (`src/app/icon.svg`, original simplified
  drawing). After editing it run `npm run icons`.

## Vehicle profile & feature tagging

Only the built-in car (`car.json` `"profile": "opel-cascada-my16"`) is tagged; imported cars
show all content without availability labels (`CarSummary.hasProfile === false`).

- `src/config/vehicle.ts` lists every feature (`FEATURES`) with a Polish label, group,
  optional Polish note and a default `{ status: "has" | "no", certainty: "confirmed" |
"verify" | "probable" }`. `verify` renders "do weryfikacji", `probable` "prawdopodobnie".
- The user can override any feature on `/ustawienia`; overrides are stored in
  `settings.vehicle` (only differences from the defaults) and merged by `resolveProfile`.
- `src/config/featureRules.ts` tags sections by regex on their **title**
  (`pattern`, optional `exclude`, optional `book`). Tags are inherited by sub-sections
  (`getSectionFeatures`). Rules are evaluated on the server when pages render; editing
  them needs no re-extraction.
- `getAvailability` (`src/lib/availability.ts`): any tagged feature with status `no` ->
  `missing` ("Brak w Twoim aucie": section collapsed by `SectionGate`, greyed in the TOC,
  lists and search, filtered from the warnings index unless "Pokaż wszystko" is on);
  else `verify` / `probable` badges; else "Twoje auto". Collapsed content stays in the DOM
  (`hidden`) so anchoring and in-page links keep working.
- To add a feature: add it to `FEATURES`, add a rule in `FEATURE_RULES`, run `npm test`.

## Content

- Format contract: `src/content/types.ts` (`BookIndex` in `index.json`, one `ChapterFile`
  per top-level chapter). Section ids are slug paths (`chapter/sub`); block ids `b1..bN`
  per section are deep-link targets (`/auto/<car>/<book>/<slug>#b12`). Page references are
  `{ page: n }` runs resolved to links by `resolvePageRef`.
- Generated content must not be edited by hand (it is overwritten by `npm run extract` or a
  re-import). Fix the extractor or its CLI options in `scripts/manuals.config.json` instead
  (see `docs/extraction.md`).
- The Cascada placeholder content (`"placeholder": true`, chapter "Zanim zaczniesz") is
  shipped until the owner runs the extraction locally. Raw PDFs are never committed
  (`manuals/`, `*.pdf`).
- Adding a car by hand: create `database/<id>/car.json` + book folders in the same format
  (the wizard does exactly this).

## Storage schema

Single localStorage key `opel-cascada-manual`, versioned (`SCHEMA_VERSION` in
`src/lib/storage/schema.ts`):

```ts
AppData {
  version: 2;
  highlights: Record<id, { id, car, book, sectionId, sectionTitle, href,
    anchor: { exact, prefix, suffix, start, end }, color, comment, createdAt, updatedAt }>;
  notebook: { pages: { id, title, body /* Markdown */, createdAt, updatedAt }[] }; // user order
  bookmarks: { id: `${car}:${book}:${sectionId}`, car, book, sectionId, title, href, createdAt }[];
  lastRead: { car, book, sectionId, title, href, scrollY, at } | null;
  settings: { fontSize, showUnavailable, vehicle: Record<featureId, FeatureState>,
    activeCar: string | null, profileName: string };
}
```

- v1 → v2 (`MIGRATIONS[1]`): everything belongs to `opel-cascada-2016`, hrefs are rewritten
  to `/auto/opel-cascada-2016/...`, bookmark ids rebuilt.
- Changing the shape: bump `SCHEMA_VERSION`, add `MIGRATIONS[oldVersion]` in
  `migrations.ts`, extend `sanitize`, add a test in `src/lib/__tests__/storage.test.ts`.
- Export file: `{ app: "opel-cascada-manual", exportedAt, data }`. Import accepts it (or bare
  data) in `merge` (newest `updatedAt` wins per id) or `replace` mode.
- Unreadable stored data is copied to `opel-cascada-manual:backup-<timestamp>` before reset.

More detail: `docs/import.md`, `docs/highlighting.md`, `docs/comments.md`,
`docs/notebook.md`, `docs/storage.md`, `docs/offline.md`, `docs/extraction.md`,
`docs/vehicle-profile.md`.

## Conventions

- TypeScript strict; Prettier (with Tailwind class sorting) and ESLint must pass.
- Never import `src/lib/content.ts` or `src/lib/server/*` (Node `fs`, `child_process`) from
  client components; pass data as props or fetch the JSON API routes.
- Every UI string is Polish; every identifier/comment English.
- Before finishing a change run: `npm run lint && npm run typecheck && npm test && npm run build`.
