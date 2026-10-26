# UI and interaction guidelines

The audience is non-technical: people who know "old internet" pages and the Opel / Navi 950
Europe screens. Every screen should be self-explanatory, calm and consistent. Visual rules
(palette, no rounded corners, silver gradients) are in `AGENTS.md` → Design rules.

## Wording (Polish UI)

- Plain words, short sentences, second person ("Wybierz auto", "Dodaj instrukcje").
- No technical terms in the UI: no file paths (`database/…`), commands (`pnpm …`, `git …`),
  formats (JSON, WebP, Markdown), storage names (localStorage, Cache API), "serwer",
  "import/eksport", HTTP codes or stack traces. Prefer: "aplikacja", "ta przeglądarka",
  "kopia zapasowa", "instrukcja", "bez internetu".
- Errors say what happened and what to do next. Technical details, if useful at all, go into a
  collapsed `<details>` labelled "Szczegóły (dla osoby technicznej)".
- Setup and maintenance (Python, `.venv`, git, moving `database/`) is documented only in
  `README.md`; the UI may point to "plik README, rozdział „Dodawanie aut”".

- Editorial Polish: „…” quotes, " – " (spaced en dash) for dashes, "…" for ellipses, sentence
  case, no full stop after headings/buttons/labels, one term per concept across the app
  (auto, instrukcja, zaznaczenie, komentarz, zakładka, notatnik, kopia zapasowa).

## Layout and text wrapping (`src/app/globals.css`)

- Alignment levels. Every edge uses one side gutter, `--gutter` (1rem on phones, 2rem from
  40rem):
  1. Frame — `.app-frame` (`--container-app`, 90rem): header top row, navigation row, footer;
     `.reader-frame` gives the reader (sidebar + text) the same edges from 64rem. The silver
     header background and red top line stay full width.
  2. Page — `.page-shell` (72rem): every other screen, centred and narrower than the frame.
  3. Reader text — `.reader-column` (48rem, ~75 characters per line); from 90rem it is 63.5rem
     wide so the "Na tej stronie" column fits, and book index and section pages keep the same
     left edge (direct children other than `.reader-grid` stay 48rem).
- Header: the brand / car logo starts exactly where the first navigation key starts
  (`.nav-link` has no left padding on the first item), and the clock ends exactly where the
  top row's last action ends.
- Project links: `ProjectLinks` shares the BuyCoffee and project repository destinations
  from `src/lib/brand.ts` between compact icon buttons beside the header search and labelled
  footer buttons. Support uses the red button; source code uses silver. Both open a new
  tab with accessible labels announcing it, without remote widgets, images or background
  requests. The footer (`Footer`) keeps the app name and package version, profile/notebook/
  settings navigation, the browser-local storage reminder and an AGPL license link.
  Its rows wrap on narrow screens. Below 40rem the header links move into the expandable
  menu with visible labels, leaving room for search; wider screens use compact icons.
- `body` sets `overflow-wrap: anywhere`, so strings without spaces (file names, codes, long
  links) break inside boxes instead of overflowing them, and flex/grid items may shrink below
  their longest word. Tables use `break-word` and scroll sideways in their wrapper. `.btn` and
  `.badge` stay on one line; use `truncate` (with a `title`) for single-line names.
- `text-wrap: balance` on headings and `.panel-title`, `text-wrap: pretty` on paragraphs and
  list items; `hyphens: auto` (with `lang="pl"`) in manual text and notebook previews.
- Fact grids do not leave permanent empty grey cells: three car metadata or technical-preview
  facts share one row, and longer technical fact lists stretch the final row.
- "Czytaj dalej" stacks its thumbnail, text and full-width action on phones; from 40rem they
  share a horizontally aligned row and the action uses its natural width.

## Type scale (`src/app/globals.css`)

One size and weight per role; do not combine ad-hoc `text-*` / `font-*` utilities for these:

| Class                         | Role                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `.type-display`               | car name on the car card, profile greeting, wizard done |
| `.page-title` / `.type-title` | page heading (with / without the red rule)              |
| `.type-card`                  | name on a card or panel (cars, reminders, warnings)     |
| `.type-item`                  | link title in a list or tile (books, tools, continue)   |
| `.type-value`                 | big numbers and measurements (stats, dates)             |
| `.type-fact`                  | values in technical data (smaller, text-heavy lists)    |
| `.section-label`              | uppercase label above a group (red dash)                |
| `.panel-title`                | silver header bar of a `.panel`                         |

Body text is `text-base`, secondary text `text-sm text-graphite`, meta `text-xs text-steel`.

## Polish typography (`src/lib/typography.ts`)

Polish typesetting does not allow a one-letter word at the end of a line ("sieroty") or a
lone short word on the last line of a paragraph ("wdowy"). `polishTypography(text, {
lastWord? })` replaces the ordinary space with a non-breaking space (U+00A0) after:

- one-letter words: a, i, o, u, w, z (any case);
- abbreviations followed by a word or number: np., m.in., tzn., tj., tzw., ok., ul., nr,
  str., s., pkt, godz., wg, ang., poz., rys., tab., zob., por., §;
- a number followed by a short unit or symbol (125 kW, 5 l, 20 °C, 30 %), and inside digit
  groups (1 500);

and before: trailing itd./itp./etc./i in., and a spaced dash (–, —). With `lastWord` the
last word of a paragraph (up to 10 characters) is bound to the previous one.

- Manual content: applied on the server by `BlockRenderer` (paragraphs and list items with
  `lastWord`; headings, warning titles, table cells without it). Stored content and the
  search index are unchanged.
- Everything else (UI, notes, comments, dynamic text): `watchTypography()`
  (`src/lib/typographyDom.ts`, started by `ClientEffects`) fixes all text nodes after
  hydration and watches for new ones with a `MutationObserver`. It skips `textarea`, `input`,
  `code`, `pre`, `kbd` and `contenteditable`.
- Replacements keep the string length, so highlight offsets stay valid; anchoring treats
  ordinary and non-breaking spaces as equal (`docs/highlighting.md`).
- Do not type non-breaking spaces by hand in UI strings; the pass is idempotent.

## Dialogs (`src/components/Dialog.tsx`)

- Native `window.confirm`, `alert` and `prompt` are not used anywhere.
- `confirmDialog({ title, message?, confirmLabel?, cancelLabel?, danger? })` resolves to
  `true`/`false`; `alertDialog()` shows a single "OK"; `promptDialog({ title, label,
placeholder?, defaultValue?, maxLength?, ... })` asks for one line of text (e.g. the profile
  name) and `formDialog({ title, fields, validate?, ... })` collects multiple fields in one
  modal and keeps it open to show validation errors. Prompts and forms resolve to their values
  or `null` on cancel – forms are never squeezed into the page. Requests are queued and rendered one at
  a time by `DialogHost` (mounted once in `src/app/layout.tsx`).
- Rendering: native `<dialog>` opened with `showModal()` (focus trap, top layer, centred by
  `margin: auto`), class `.app-dialog`; `::backdrop` is semi-transparent ink with
  `backdrop-filter: blur(3px)`. Short fade/raise animation on open.
- Escape and a click on the backdrop cancel. `danger: true` puts the initial focus on
  "Anuluj" so Enter never confirms a destructive action by accident.
- Title is a question ("Usunąć kartkę?"); the main button names the action ("Usuń kartkę"),
  not "OK".

## Interaction states (`src/app/globals.css`)

- Links, buttons and `summary` get a 160 ms colour/background/border fade (base layer).
- `.btn`: hover lightens the silver gradient and darkens the border; `:active` moves the
  button 1px down, flips the gradient and adds a faint inset shadow — a subtle "pressed key".
  A soft radial sheen sweeps across the silver button and fades to transparent at its edges;
  `.btn-primary` and `.btn-ghost` have matching pressed states.
- `.btn-primary` (red) uses one smooth vertical gradient (`--red-gradient`, light top edge,
  deeper bottom) painted under a transparent border (`border-box`), so no darker rim shows.
  Its hover never swaps the red background: it reuses the silver sweep (`.btn::before`, same
  ellipse, position and timing) with a softer white light that fades out before the edges.
  Do not change the red background on hover or layer extra gradients on it – that bands.
- Reminder dates use the app's own Monday-first six-week calendar grid, not the browser's
  native date picker. The selected day uses `.calendar-day-selected` and `--red-gradient`;
  today has a graphite outline so the date control stays within the app palette. Months are
  directly selectable (future months and days are disabled); arrows move by one month.
  The field accepts digits, `.`, `,` and `/` (separators become dots, digit-only input gets
  dots inserted) and shows `DD.MM.YYYY`; a valid entry opens the calendar on that date. The
  calendar key sits inside the field on the right, and the calendar flips above the field when
  the viewport has too little space below.
- Header: the navigation row ends with the local weekday, date and time (`Clock` in
  `Header.tsx`, desktop only, filled after hydration and refreshed every 15 s; no requests;
  until then `Skeleton` lines hold the final boxes: the date sits right-aligned in a
  `min-w-[11.75rem]` box that fits the longest Polish date, the time in a `5ch` box)
  and a red "Bez internetu" badge when offline. "Przypomnienia" carries a `.nav-count` badge
  with reminders that passed or are due within 30 days. There is no separate status bar.
  On phones, the main navigation overlays the page below the sticky header instead of
  changing the page position; the reader's "Spis treści" overlay behaves the same way.
  The search field and its button share one red hover/focus border.
- The footer uses the dynamic viewport height and safe-area insets so it remains readable
  above mobile browser controls and device home indicators.
- No layout jumps on load: client parts that depend on browser data render their final
  layout before hydration from the layout hint (`useLayoutHint()`, `docs/storage.md`). A
  placeholder must have the exact box of what replaces it: same element structure, fixed
  heights (`h-40` note bodies, single-line `truncate` rows) and `Skeleton` without a height
  class, which is exactly one text line of the surrounding font size. Never render a
  generic skeleton block of a different size, and never gate a whole section on
  `useHydrated()` when the hint can say whether it exists. Static UI text that is rendered
  before hydration may be passed through `polishTypography()` so the client typography pass
  does not reflow it. Further rules, each verified with the browser's `layout-shift` entries
  on every page (phone and desktop, empty and filled profile, production build):
  - Prefer the real markup with disabled controls over skeleton blocks when the layout
    does not depend on data (settings, the search form in its Suspense fallback, the
    engine field: "Wczytuję silniki…" is shown inside the field, not as an extra line).
  - Status that comes and goes (preparing search, results count) lives in one fixed-height
    line; a check whose usual result is "nothing to show" (the add-car readiness check)
    has no placeholder at all.
  - Content known only in the browser (notification permission) renders its usual box and
    sits after the main content, so hiding it in the rare case moves nothing.
  - Buttons whose label changes keep the width of the longer label (both labels share
    one grid cell, `BookmarkButton`).
  - Images get their final size before loading: brand logos use the pixel size of the
    cached logo (`CarSummary.logo`, `docs/logos.md`).
- Car overview screens (car page with "Niezbędnik", "Dane techniczne") and the reader side
  column are described in `docs/car-overview.md`; their classes are `.car-hero`,
  `.car-hero-logo`, `.car-hero-spec`, `.stat-strip`/`.stat-cell`, `.nav-key`, `.section-label`
  (red dash + uppercase label), `.fav-bar`/`.fav-key`/`.fav-num` and `.thumb` (framed
  manual illustration).
- The reader's "Na tej stronie" outline follows the most visible heading part below the
  sticky header. A part must occupy at least one third of that readable viewport; shorter
  parts must be fully visible. Equal coverage prefers the part nearest the upper-third
  reading line. Hidden equipment parts are excluded. Scroll, resizing, illustrations and
  equipment/table expansion all update the measurement. The active link has
  `aria-current="location"` and a square red background at 8% opacity without animation.
  Main headings (level 2) are always semibold, while subheadings (level 3) stay regular.
  Selection never changes font weight, adds text shadows or alters line breaks.
  A continuous red progress bar grows from the top of the silver track in discrete steps,
  always ending at the bottom of the active heading's link. It does not interpolate within
  a heading part. When the content end is visible, the final visible heading is selected
  even if the preceding part occupies more of the viewport. This selection persists past
  the content end. Fill is always derived from that same selected link, never independently
  forced to 100%; hidden trailing parts do not advance it beyond the selected heading.
  Selection and fill update in one React commit. Each step animates with a 200 ms CSS
  transform. The side pane smoothly reveals the active link
  with 96 px of context above and below (at most one quarter of the pane height), without
  scrolling the article. Scrolling clamps at the edges, revealing the 48 px end padding
  instead of pinning the final heading to the pane's bottom. When the document's end becomes
  visible, the pane scrolls fully to its end, including any warnings and final padding.
  Resizing recalculates both
  progress and side-pane positioning. All motion respects `prefers-reduced-motion`.
- Add-car wizard (`/dodaj-auto`) is the only car-addition flow; no ready-car picker precedes
  it. Brand/model/year form three columns on wider screens. A manual year replaces the
  select with an input. Matching saved manuals appear before any upload control, with
  reordering and an optional expandable file picker. `WizardMotion` measures dynamic
  content with `ResizeObserver` and transitions its height; `WizardReveal` transitions
  grid rows and opacity and makes closed controls inert. Step content fades in without
  refreshing the route; all these animations are disabled for reduced motion.
  The step strip (`.wizard-track`) shows square keys on one
  line with a red track growing with progress (`--wizard-progress`); phones show the keys plus
  one "Etap n z 4" line. Step 1 is split into lettered panels ("A Twoje auto", "B Instrukcje",
  `.wizard-mark`) and a sticky "Podsumowanie" card with the chosen car, missing items and the
  main button; the PDF drop area is `.wizard-drop`. Step 2 shows the first page of each
  manual on a horizontal "film strip" (`.film-strip`/`.film-frame[data-state]`) with a thin
  progress bar on the thumbnail (`.film-progress`, indeterminate while reading, static with
  reduced motion). Step 4 shows the car card (`CarHero`) with totals instead of a list.
- `.field` (inputs, selects, textareas): hover darkens the border; focus shows exactly one
  cue — a graphite border. No outline ring, underline or shadow on top of it. Other
  focusable elements keep the global red `:focus-visible` outline for keyboard users.
- Selects keep their native accessible behavior and option menus, but use a shared silver
  field and graphite arrow. Checkboxes use a square red selected state and retain the global
  red keyboard focus outline. Native `details` disclosures use the same small red chevron.
- The profile lists only cars assigned to that browser profile. Other readable cars can be
  added from `/dodaj-auto` without importing their manuals again; removing a car from the list
  does not delete its manuals or saved annotations. `/auto/<id>` is the selected-car information
  page with manual links and scoped tools. Its equipment button opens the separate
  `/auto/<id>/wyposazenie` editor.
- Selected-car tools are grouped in a two-column layout and include search and warnings scoped
  to that car. Warnings are opened from this view rather than the global navigation. Comments,
  bookmarks and notes remain in the app-wide navigation.
- Hover only on what can be clicked: a link/button itself, or a card holding its own buttons
  (car cards). Static panels, stat cells, tables and free slots have no hover and no movement.
- `.hover-tile`: clickable cards/panels get a darker border and a soft shadow on hover; only
  `a`/`button` tiles get the 1px press on `:active` (cards with inner buttons never move).
- The page backdrop is made from layered, irregular CSS radial gradients in the existing
  neutral palette; it uses no images or additional visual dependencies.
- The global header never changes per view. "Wstecz" (`BackButton`) belongs to the view: in the
  manual it is the first row of the table of contents (`.sidebar-back`: white key, red arrow,
  above the book groups); on other secondary screens it sits above the content in
  `.back-navigation`, aligned with `.page-shell`. Main views
  of the top navigation (`/`, car page, `/auta`, `/przypomnienia`, `/notatnik`, `/komentarze`,
  `/zakladki`, `/ustawienia`) intentionally have none. The reader key uses `.btn` cursor,
  focus, hover and press feedback. It returns to the previous distinct manual page of the
  current car, skipping other screens and in-page anchors. The public Navigation API
  provides exact native history traversal where available; otherwise a per-tab reader trail
  is consumed. Once exhausted, it opens the current book's introductory index without a
  selected category, then the car home screen on the next click. The fallback sets a
  boundary so it cannot loop back to the
  exhausted page. Other secondary screens retain the prior same-origin-view fallback.
- Technical fact layouts contain no grey empty cells: preview cards with three values have
  three columns; larger fact lists wrap and stretch their final row to fill the available
  width.
- `prefers-reduced-motion: reduce` shortens all transitions/animations to 1 ms and removes
  the press movement.

## Connection state

`useOnline()` (`src/lib/offline.ts`) drives the red "Bez internetu" badge next to the clock
in the header, the notice above the
car list and the "Brak połączenia" message in the add-car wizard. Reading saved cars never
depends on it.
