<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — opel-cascada-manual

Private, local-only Next.js app presenting the full Polish content of the two official
Opel Cascada MY16 owner manuals (main manual + Navi 950 infotainment), personalised to the
owner's car, with highlighting, comments, a notebook and bookmarks. All user data lives in
the browser only (localStorage + Cache API). There is no backend, no database, no external
API calls and no analytics — keep it that way.

## Language rules (strict)

| What                                                                        | Language    |
| --------------------------------------------------------------------------- | ----------- |
| Code, identifiers, code comments, commit messages, `AGENTS.md`, `docs/*.md` | **English** |
| UI text, page content, manual content, root `README.md`, user-facing errors | **Polish**  |

## Commands

```bash
npm run dev            # dev server (service worker disabled)
npm run build          # static export to out/ + precache manifest injected into out/sw.js
npm start              # serve out/ on :3000 (clean URLs)
npm run lint           # ESLint
npm run typecheck      # next typegen && tsc --noEmit
npm test               # Vitest (src/**/*.test.ts)
npm run test:extract   # Python unittest for scripts/extract.py (needs PyMuPDF)
npm run fetch-manuals  # download PDFs into manuals/ (git-ignored)
npm run extract        # PDFs -> src/content/** + public/assets/**
npm run icons          # src/app/icon.svg -> apple-icon.png + favicon.ico
```

## Architecture

```
scripts/                 extraction pipeline (Python + Node wrappers), icon/precache generators
  extract.py             PDF -> JSON blocks + WebP images (PyMuPDF, Pillow)
  extract.mjs            runs extract.py for each book in manuals.config.json
  fetch-manuals.mjs      downloads the PDFs
  generate-precache.mjs  post-build: injects the exported file list into out/sw.js
  generate-icons.mjs     renders favicon/apple icon from the SVG
  tests/                 synthetic sample PDF + extractor tests
public/
  assets/<book>/<chapter>/p<page>-<n>.webp   extracted illustrations (generated)
  sw.js                  service worker template
  highlights.css         ::highlight() styles (not processed by the CSS bundler)
src/
  app/                   App Router pages (static export, all routes prerendered)
    [book]/              book index + sidebar layout ("instrukcja", "navi-950")
    [book]/[...slug]/    section pages
    search-index.json/   static route handler emitting the search corpus
    szukaj, ostrzezenia, komentarze, zakladki, notatnik, ustawienia, twoje-auto
  components/            UI components (server: BlockRenderer; the rest are client)
  config/vehicle.ts      vehicle profile: feature definitions + defaults
  config/featureRules.ts title-based rules tagging sections with features
  content/               generated content (JSON) + types.ts (format contract)
  lib/content.ts         build-time content API (Node fs; never import from client code)
  lib/storage/           localStorage store, schema, migrations, React hooks
  lib/anchoring/         text-quote/position anchoring + DOM helpers
  lib/availability.ts    feature tags + profile -> "Twoje auto"/"Brak w Twoim aucie"/...
  lib/search.ts          Polish normalisation for search
```

- **Static export** (`output: "export"`): every dynamic route needs `generateStaticParams`
  and `dynamicParams = false`; route handlers need `export const dynamic = "force-static"`.
  No server actions, cookies, headers, `next/font/google` (no network) or image optimisation.
- Content is read at build time by `src/lib/content.ts`. Client components receive plain
  serialisable props only.
- Client state comes from `useAppData()` (`useSyncExternalStore` over the store). Anything that
  depends on stored data must wait for `useHydrated()` to avoid hydration mismatches.

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

- `src/config/vehicle.ts` lists every feature (`FEATURES`) with a Polish label, group,
  optional Polish note and a default `{ status: "has" | "no", certainty: "confirmed" |
"verify" | "probable" }`. `verify` renders "do weryfikacji", `probable` "prawdopodobnie".
- The user can override any feature on `/ustawienia`; overrides are stored in
  `settings.vehicle` (only differences from the defaults) and merged by `resolveProfile`.
- `src/config/featureRules.ts` tags sections by regex on their **title**
  (`pattern`, optional `exclude`, optional `book`). Tags are inherited by sub-sections
  (`getSectionFeatures`). Rules are evaluated at build time; editing them needs no
  re-extraction.
- `getAvailability` (`src/lib/availability.ts`): any tagged feature with status `no` ->
  `missing` ("Brak w Twoim aucie": section collapsed by `SectionGate`, greyed in the TOC,
  lists and search, filtered from the warnings index unless "Pokaż wszystko" is on);
  else `verify` / `probable` badges; else "Twoje auto". Collapsed content stays in the DOM
  (`hidden`) so anchoring and in-page links keep working.
- To add a feature: add it to `FEATURES`, add a rule in `FEATURE_RULES`, run `npm test`.

## Content

- Format contract: `src/content/types.ts` (`BookIndex` in `index.json`, one `ChapterFile`
  per top-level chapter). Section ids are slug paths (`chapter/sub`); block ids `b1..bN`
  per section are deep-link targets (`/instrukcja/<slug>#b12`). Page references are
  `{ page: n }` runs resolved to links by `resolvePageRef`.
- Generated content must not be edited by hand (it is overwritten by `npm run extract`).
  Fix the extractor or its CLI options in `scripts/manuals.config.json` instead
  (see `docs/extraction.md`).
- The placeholder content (`"placeholder": true`, chapter "Zanim zaczniesz") is shipped until
  the owner runs the extraction locally. Raw PDFs are never committed (`manuals/`, `*.pdf`).

## Storage schema

Single localStorage key `opel-cascada-manual`, versioned (`SCHEMA_VERSION` in
`src/lib/storage/schema.ts`):

```ts
AppData {
  version: 1;
  highlights: Record<id, { id, book, sectionId, sectionTitle, href,
    anchor: { exact, prefix, suffix, start, end }, color, comment, createdAt, updatedAt }>;
  notebook: { pages: { id, title, body, createdAt, updatedAt }[] };   // array order = user order
  bookmarks: { id: `${book}:${sectionId}`, book, sectionId, title, href, createdAt }[];
  lastRead: { book, sectionId, title, href, scrollY, at } | null;
  settings: { fontSize, showUnavailable, vehicle: Record<featureId, FeatureState> };
}
```

- Changing the shape: bump `SCHEMA_VERSION`, add `MIGRATIONS[oldVersion]` in
  `migrations.ts`, extend `sanitize`, add a test in `src/lib/__tests__/storage.test.ts`.
- Export file: `{ app: "opel-cascada-manual", exportedAt, data }`. Import accepts it (or bare
  data) in `merge` (newest `updatedAt` wins per id) or `replace` mode.
- Unreadable stored data is copied to `opel-cascada-manual:backup-<timestamp>` before reset.

More detail: `docs/highlighting.md`, `docs/comments.md`, `docs/notebook.md`,
`docs/storage.md`, `docs/offline.md`, `docs/extraction.md`.

## Conventions

- TypeScript strict; Prettier (with Tailwind class sorting) and ESLint must pass.
- Keep client bundles small: do not import `src/lib/content.ts` (Node `fs`) from client
  components; pass data as props or via `search-index.json`.
- Every UI string is Polish; every identifier/comment English.
- Before finishing a change run: `npm run lint && npm run typecheck && npm test && npm run build`.
