# Car overview screens

Navi 950 "home screen" elements built only from data the app already has: the generated
manuals in `database/`, the catalogue engine data in `car.json` (`spec`) and the browser
profile. Nothing here makes a network request; tiles without data are not rendered.

## Server collection (`src/lib/carOverview.ts`)

Server-only (reads `src/lib/content.ts`); results are memoised per car and
`getCarVersion(car)`, so a re-import refreshes them.

- `getCarOverview(car)` → `stats` (pages, sections, illustrations, icons, warnings by kind),
  `tiles` ("Najczęściej potrzebne"), `glossaryCount`, `techCount`, `techPreview` (up to four
  measured facts) and `serviceHref` (section about periodic service).
- `getGlossary(car)` → pictograms with their explanation grouped by section. Sections whose
  title chain matches `INDICATOR_SECTION` come first; when a manual has none, all icons are
  used. Duplicates (same image and text) are dropped; at most ~240 symbols.
- `getTechCards(car)` scans every section so more manuals get "Dane techniczne":
  - sections matching `TECHNICAL_SECTION` (technical data, specifications, tyre sizes, loads,
    fluids, tightening torques, …) give all their tables plus `textFacts` groups (≥ 2
    consecutive "Label: value with unit" lines);
  - any other section gives only measurement tables (`isMeasurementTable`: ≥ 2 rows, at least
    half with a value and unit, `hasMeasurement`).
    Two-column tables become label/value facts (`tableFacts`), others stay tables. Each links to
    its block. `techPreview` keeps only facts with a measured value.
- `getSectionThumb(ctx, section)` → first non-icon illustration (≥ 120×80) of a section.
- `getTips(cars)` → "Czy wiesz, że…" notes (`warning` blocks of kind `note`, ≥ 40 characters),
  at most 30 per car spread over the whole manual.

Pure helpers and shared types live in `src/lib/overview.ts` (client-safe, tested in
`src/lib/__tests__/overview.test.ts`): `runsToText`, `blockToText`, `shorten`,
`firstIllustration`, `iconEntries`, `tableFacts`, `isNumeric`, `kwToHp`, `specParts`.

## Topic rules (`src/config/quickTopics.ts`)

`QUICK_TOPICS` are regex rules on Polish section titles (tyres, wheel change, fuses, bulbs,
oil and fluids, fuel, indicators, roadside help, service), like `featureRules.ts`. The first
matching section per topic becomes a tile; at most `QUICK_TOPICS_MAX` (8). The "Lampki
kontrolne" tile opens the glossary page when the car has symbols. Editing rules needs no
re-extraction.

## Screens

- Car page `/auto/<car>`: `CarHero` (logo, brand, model + year, engine chips from
  `specParts`: capacity, kW and KM, fuel), `CarStatsStrip` (warnings link to
  `/ostrzezenia?car=`; the last cell is the offline copy state and jumps to `#bez-internetu`),
  "Czytaj dalej", `FavoritesBar` ("Ulubione": the six newest bookmarks of the car as numbered
  keys; bookmarks are only created with "Dodaj zakładkę" in the manual, there is no separate
  pinning; the bar is hidden while the car has no bookmarks), `QuickTiles`, books, tools; side
  column: `TechPreview`, `ServiceReminders` (inspection and OC insurance always; a third row
  with the nearest own reminder only once one exists; "Ustaw przypomnienia" links to
  `/przypomnienia#<car>`). The last, full-width section is `CarActions` ("Bez internetu",
  `#bez-internetu`: status, progress, "Zapisz ponownie"); the stats strip only shows the status
  and links there. Removing a car from the profile is done on the profile (`CarPicker`), not here.
- `/przypomnienia` (`RemindersView`, in the main navigation): one panel per car of the profile
  (`id` = car id) with two fixed yearly deadlines – "Badanie techniczne" and "Ubezpieczenie
  OC" (date field, "za N dni" badge, "Załatwione – za rok" moves the date by one year) – and
  "Inne przypomnienia" (own entries with date and/or mileage, `CustomReminders`) plus a link
  to the servicing section of the manual (`CarOverview.serviceHref`).
- `/auto/<car>/lampki-kontrolne`: symbol cards with a local text filter; each card links to
  the image block (`#<blockId>`) in the manual.
- `/auto/<car>/dane-techniczne`: fact cards (values in `.type-fact`) and compact tables, each with
  "Pokaż w instrukcji". `lampki-kontrolne` and `dane-techniczne` are reserved book routes
  (`RESERVED_BOOK_ROUTES`) and part of the offline copy (`getCarUrls`).
- Reader (`/auto/<car>/<book>/<section>`): previous/next links with section thumbnails. From
  90rem a side column (`.reader-grid`, the book layout widens to 63.5rem only for it) lists
  "Na tej stronie" (level 2–3 headings), the warnings of the section by kind and "Moje
  zaznaczenia" (client, `#hl-<id>` links).
- Profile `/`: "Czytaj dalej" with the history thumbnail, "Ostatnio czytane" (history),
  "Ostatnie zaznaczenia i komentarze" and `TipCard` (random tip of the profile's cars; the
  server picks the seed, so the tip is rendered on the first paint). Before hydration all of
  them render from the layout hint (`docs/storage.md`), with placeholder rows of the same size.
- Add-car wizard: step 2 film strip, step 4 `CarHero` from `GET /api/cars/<id>`.

## Browser data (schema v5, `docs/storage.md`)

`history`, `reminders` and `bookmarks` back "Ostatnio czytane", "Przypomnienia"
and "Ulubione". Reminders are not system notifications: they are shown on `/przypomnienia`,
on the car page and as a count in the navigation, with "termin minął" / "za N dni" computed
on the device (`src/lib/reminders.ts`, local calendar days, "soon" = 30 days).
