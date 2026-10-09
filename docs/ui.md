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

- Maximum app width: `--container-app` (90rem, Tailwind `max-w-app`) for the header bar
  contents, the main navigation, the reader shell (sidebar + text) and the footer; the silver
  header background and red top line stay full width. Top-level screens share `.page-shell`
  (72rem, matching `max-w-6xl`), with consistent horizontal padding; the manual reader retains
  its wider shell and a `max-w-3xl` text column (~75 characters per line).
- `body` sets `overflow-wrap: anywhere`, so strings without spaces (file names, codes, long
  links) break inside boxes instead of overflowing them, and flex/grid items may shrink below
  their longest word. Tables use `break-word` and scroll sideways in their wrapper. `.btn` and
  `.badge` stay on one line; use `truncate` (with a `title`) for single-line names.
- `text-wrap: balance` on headings and `.panel-title`, `text-wrap: pretty` on paragraphs and
  list items; `hyphens: auto` (with `lang="pl"`) in manual text and notebook previews.

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
  `true`/`false`; `alertDialog()` shows a single "OK". Requests are queued and rendered one at
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
  deeper bottom) with a faint inner top highlight. Its hover never swaps the background and
  has no moving sheen: a single top-light overlay fades in by opacity only. Do not stack
  radial gradients on red surfaces – they band visibly on small buttons.
- Add-car wizard (`/dodaj-auto`): the step strip (`.wizard-track`) shows square keys on one
  line with a red track growing with progress (`--wizard-progress`); phones show the keys plus
  one "Etap n z 4" line. Step 1 is split into lettered panels ("A Twoje auto", "B Instrukcje",
  `.wizard-mark`) and a sticky "Podsumowanie" card with the chosen car, missing items and the
  main button; the PDF drop area is `.wizard-drop`.
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
- `.hover-tile`: clickable cards/panels (car cards, profile and book tiles) get a darker
  border and a soft shadow on hover and a 1px press on `:active`.
- The page backdrop is made from layered, irregular CSS radial gradients in the existing
  neutral palette; it uses no images or additional visual dependencies.
- Views outside the primary header navigation expose a shared "Wstecz" control aligned to the
  reader shell width; it returns to the prior same-origin view and uses the relevant car, book,
  or profile as a direct-entry fallback.
- `prefers-reduced-motion: reduce` shortens all transitions/animations to 1 ms and removes
  the press movement.

## Connection state

`useOnline()` (`src/lib/offline.ts`) drives the header "Offline" badge, the notice above the
car list and the "Brak połączenia" message in the add-car wizard. Reading saved cars never
depends on it.
