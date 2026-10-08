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
- Setup and maintenance (Python, `.venv`, git, sharing `database/`) is documented only in
  `README.md`; the UI may point to "plik README, rozdział „Dodawanie aut”".

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
  `.btn-primary` and `.btn-ghost` have matching pressed states.
- `.field` (inputs, selects, textareas): hover darkens the border; focus shows exactly one
  cue — a graphite border. No outline ring, underline or shadow on top of it. Other
  focusable elements keep the global red `:focus-visible` outline for keyboard users.
- `.hover-tile`: clickable cards/panels (car cards, profile and book tiles) get a darker
  border and a soft shadow on hover and a 1px press on `:active`.
- `prefers-reduced-motion: reduce` shortens all transitions/animations to 1 ms and removes
  the press movement.

## Connection state

`useOnline()` (`src/lib/offline.ts`) drives the header "Offline" badge, the notice above the
car list and the "Brak połączenia" message in the add-car wizard. Reading saved cars never
depends on it.
