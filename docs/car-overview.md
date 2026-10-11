# Car overview screens

Navi 950 "home screen" elements built only from data the app already has: the generated
manuals in `database/` and the browser profile (including the selected engine).
The overview makes no network request; tiles without data are not rendered.

## Server collection (`src/lib/carOverview.ts`)

Server-only (reads `src/lib/content.ts`); results are memoised per car and
`getCarVersion(car)`, so a re-import refreshes them.

- `getCarOverview(car)` → `stats` (pages, sections, illustrations, icons, warnings by kind),
  `essentials` ("Niezbędnik" tiles), `techCount` and `serviceHref` (the fragment the
  "Przeglądy" topic found).
- `getTechCards(car)` scans every section so more manuals get "Dane techniczne":
  - sections matching `TECHNICAL_SECTION` (technical data, specifications, tyre sizes, loads,
    fluids, tightening torques, …) give all their tables plus `textFacts` groups (≥ 2
    consecutive "Label: value with unit" lines);
  - any other section gives only measurement tables (`isMeasurementTable`: ≥ 2 rows, at least
    half with a value and unit, `hasMeasurement`).
    Two-column tables become label/value facts (`tableFacts`), others stay tables. Each links to
    its block and preserves its preceding printed heading as context.
- `getManualEngines(car)` joins explicitly labelled engine tables by manufacturer code
  (`src/lib/engines.ts`).
- `driverFacts` (`src/lib/driverFacts.ts`, client-safe) selects up to four useful values:
  owner's engine and fuel, then tank capacity, source-reported mixed/average consumption,
  selected engine torque, turning circle or luggage capacity. It carries units from labels,
  deduplicates repeats and preserves alternatives and qualifications. It never calculates
  expected real-world consumption or presents ambiguous engine matrices as personal values.
  Source values link to their original blocks; oil-viscosity rows are not overview facts.
  Without an engine choice, consumption and torque are omitted even from two-column tables;
  only model-wide capacities and dimensions are eligible.
- `getSectionThumb(ctx, section)` → first non-icon illustration (≥ 120×80) of a section.
- `getTips(cars)` → "Czy wiesz, że…" notes (`warning` blocks of kind `note`, ≥ 40 characters),
  at most 30 per car spread over the whole manual.

Pure helpers and shared types live in `src/lib/overview.ts` (client-safe, tested in
`src/lib/__tests__/overview.test.ts`): `runsToText`, `blockToText`, `shorten`,
`firstIllustration`, `tableFacts`, `isNumeric`, `kwToHp`, `specParts`.

## "Niezbędnik" (`src/config/essentials.ts`)

`ESSENTIALS` lists topics in order of importance (indicators, tyre pressure, wheel change,
fuses, bulbs, oil and fluids, fuel, roadside help, battery, service, key, wipers, technical
data), each with a Polish title, a one-line description and a line icon (`TopicIcon`).
Candidates are every section **and every heading inside a section** of the car's manuals, so
a tile opens the exact fragment (`…/<section>#bN`), e.g. "Bezpieczniki" inside "Bezpieczniki
i żarówki". `pickEssential` takes the first of the topic's `patterns` with any match
(stronger titles first), drops `exclude` titles and matches inside `avoid` sections (e.g. the
air-conditioning upkeep is not "Przeglądy"), then prefers a match inside a `context` section,
then a whole section over a heading, then the earliest in reading order. A place is used by
one tile only. When fewer than four topics are found, chapters (level 1 sections) fill the
tiles up to four (book icon, "Rozdział instrukcji od str. N."). The count is cut to 8, 6 or 4
(`essentialsSize`) so rows are always full: `EssentialTiles` shows 4 tiles on phones (2
columns), 6 from `sm` (3 columns) and 8 from `xl` (4 columns); four tiles use 2, then 4
columns. Editing rules needs no re-extraction; `src/lib/__tests__/overview.test.ts` and
`essentials.test.ts` cover the choices.

## Screens

- Car page `/auto/<car>`: `CarHero` (logo, brand, model + year, engine chips from
  `specParts` from the local engine: capacity, kW and KM, fuel), `CarStatsStrip` (two full-width
  rows that wrap without gaps: pages, sections, illustrations and the offline copy state, which
  jumps to `#bez-internetu`; then one cell per warning kind present, named and counted like
  the filters of `/ostrzezenia` via `src/lib/warnings.ts`, each linking to
  `/ostrzezenia?car=<car>&rodzaj=<kind>`),
  "Czytaj dalej", `FavoritesBar` ("Ulubione": the six newest bookmarks of the car as numbered
  keys; bookmarks are only created with "Dodaj zakładkę" in the manual, there is no separate
  pinning; the bar is hidden while the car has no bookmarks), `EssentialTiles`, books, tools; side
  column: `TechPreview`, `ServiceReminders` (inspection and OC insurance always; a third row
  with the nearest own reminder only once one exists; "Ustaw przypomnienia" links to
  `/przypomnienia#<car>`) and, as the last tile, `CarActions` ("Bez internetu",
  `#bez-internetu`: status, progress, "Zapisz ponownie"). The stats strip cell only shows ✓ / –
  with "dostęp bez internetu" and links to that tile. Removing a car from the profile is done on the profile (`CarPicker`), not here.
- `/przypomnienia` (`RemindersView`, in the main navigation): one panel per car of the profile
  (`id` = car id) with two fixed yearly deadlines – "Badanie techniczne" and "Ubezpieczenie
  OC". The owner enters the last inspection / policy start date and the next deadline is
  calculated one year later; existing deadlines remain visible until a source date is entered.
  Own reminders have dates and/or mileage and can be deleted. Optional native browser
  notifications are checked while the app is open, plus a link to the servicing section
  (`CarOverview.serviceHref`).
- `/ostrzezenia?car=<car>&rodzaj=<kind>`: the warnings list opens with that kind's filter
  (`niebezpieczenstwo`, `ostrzezenie`, `przestroga`, `uwaga`); choosing a filter replaces the
  URL (`history.replaceState`), so a reload keeps it and "Wstecz" returns to the car. Only
  kinds present in the car's manuals get a filter; an unknown or empty kind shows all.
- `/auto/<car>/dane-techniczne`: fact cards (values in `.type-fact`) and compact tables, each with
  "Pokaż w instrukcji". Engine tables reuse `EngineTable` from the reader, with per-table
  expansion and the global show-all setting. `dane-techniczne` is a reserved book route
  (`RESERVED_BOOK_ROUTES`) and part of the offline copy (`getCarUrls`).
- Reader (`/auto/<car>/<book>/<section>`): previous/next links with section thumbnails. From
  90rem a side column (`.reader-grid`, the book layout widens to 63.5rem only for it) lists
  "Na tej stronie" (level 2–3 headings), the warnings of the section by kind and "Moje
  zaznaczenia" (client, `#hl-<id>` links). The client `SectionOutline` tracks the visible
  heading part and reveals its active link in the side pane; visibility thresholds and
  the animated red marker are described in `docs/ui.md`.
- Profile `/`: "Czytaj dalej" with the history thumbnail, "Ostatnio czytane" (history),
  "Ostatnie zaznaczenia i komentarze" and `TipCard` (random tip of the profile's cars; the
  server picks the seed, so the tip is rendered on the first paint). When only one of the two
  lists has entries, the free half shows `UpcomingDeadlines` ("Najbliższe terminy": inspection
  and OC of the profile's cars, nearest first, at most four rows, links to `/przypomnienia`);
  without owned cars the single list spans the row. The counters at the bottom follow the
  navigation order: notebook pages, highlights, comments, bookmarks. Before hydration all of
  them render from the layout hint (`docs/storage.md`), with placeholder rows of the same size.
- `/przypomnienia` without cars: a short explanation and "Dodaj auto" (`/dodaj-auto`).
- Add-car wizard: step 2 film strip, step 4 `CarHero` from `GET /api/cars/<id>`.

## Browser data (schema v7, `docs/storage.md`)

`history`, `reminders` and `bookmarks` back "Ostatnio czytane", "Przypomnienia"
and "Ulubione". Reminders are shown on `/przypomnienia`, on the car page and as a count in
the navigation, with "termin minął" / "za N dni" computed on the device
(`src/lib/reminders.ts`, local calendar days, "soon" = 30 days). Optional native browser
notifications are checked while the app is open; no server sends them in the background.
