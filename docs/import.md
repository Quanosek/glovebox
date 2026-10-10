# Adding cars (PDF import)

Users add their own cars at `/dodaj-auto` without any database server: the local Next.js
server converts uploaded PDF manuals into the JSON + WebP format and stores them in
`database/<car>/`. The PDFs are deleted afterwards. `database/` is git-ignored — every
checkout has its own local vehicle database (copy the folder to move cars between
computers).

## Wizard (`src/app/dodaj-auto/`)

`AddCarWizard.tsx` holds the state and the step 1 form; `ImportSteps.tsx` the reading,
equipment and done steps; `Availability.tsx` the status shown when cars cannot be added;
`WizardChrome.tsx` the step strip and shared panel parts; `wizardModel.ts` the types,
constants and catalogue list loading. File titles and sizes come from `src/lib/files.ts`
(shared with the server importer).

Written for non-technical users: plain Polish, no paths, commands, file formats or install
instructions in the UI (those live in `README.md`, section "Dodawanie aut"). Four steps:

1. **Auto i instrukcje** — brand → model → year selects, each disabled until the
   previous one is set. Lists come from the official catalogue (`/api/catalog/*`,
   `docs/catalog.md`): brands grouped "Popularne" / "Pozostałe" / "Marki z rynku
   amerykańskiego", models of the brand, and observed model years plus upcoming years for
   recently registered models (descending). No engine is requested in this step; it is
   selected later in the equipment editor and stored only in the browser profile.
   A stale answer is ignored (request ticket); a
   failed list shows "Spróbuj ponownie". The last brand option "Inna (wpiszę ręcznie)"
   switches to free-text brand + model (required), a year select from `maxYear()`
   (current + 1) down to `MIN_YEAR` (1950) and an optional variant text. When the catalogue
   is unavailable, only "Inna" is offered.
   For a known brand/model, "Inny rocznik" opens a second year select with unlisted
   years in the same supported range. It preserves the selected display names and sends
   `source=other`; no catalogue provenance is claimed for an unlisted year. Changing
   brand/model resets the manual year; choosing a listed year restores catalogue validation.
   Below, a dashed dropzone (drag & drop or file picker) with a card grid: first-page preview
   (`src/lib/pdfPreview.ts`, pdfjs-dist with its worker, rendered sequentially to limit
   memory), editable name (becomes the book title), page count, size, reorder and remove.
   Non-PDFs, duplicates (name + size + mtime), files over the size limit and files beyond the
   10-document limit are skipped with a message.
   `GET /api/system` runs in the background. When adding is impossible, `Availability` shows
   one plain message above the form and the submit button stays disabled:
   offline / server unreachable → "Brak połączenia"; running job → "Trwa dodawanie innego
   auta" + "Pokaż postęp" (resumes polling); `localAccess === false` → "Dodawanie tylko na
   komputerze z aplikacją"; missing Python/PyMuPDF/Pillow, extractor or writable `database/`
   → "Ten komputer nie jest jeszcze gotowy" (points to the README). Technical details from
   `/api/system` are never rendered.
2. **Odczytywanie** — `XMLHttpRequest` multipart POST to `/api/cars` (for upload progress),
   then `GET /api/jobs/<id>` is polled every second; per-document state and counts are shown.
   Extractor errors and log lines are hidden behind "Szczegóły (dla osoby technicznej)".
3. **Wyposażenie** — `GET /api/cars/<car>/features` lists the optional equipment found in
   the new manuals and their engine variants; `EquipmentEditor` lets the owner choose an
   exact engine and mark equipment. The local selection supplies probable fuel-related
   suggestions. Can be skipped and edited later at `/auto/<car>/wyposazenie`
   (`docs/vehicle-profile.md`).
4. **Gotowe** — summary, "Otwórz instrukcje auta" (sets `settings.activeCar`, which also
   starts the automatic offline copy), "Dodaj kolejne auto". `router.refresh()` reloads
   server components so the header and lists include the new car.

Moving cars to another computer is a developer task (copy `database/<car>/`), documented
in `README.md`, not in the UI.

## API

| Route                      | Method | Notes                                                                                           |
| -------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `/api/system`              | GET    | environment check (forces Python re-detection)                                                  |
| `/api/cars`                | GET    | `{ cars: CarSummary[] }`                                                                        |
| `/api/cars`                | POST   | multipart `source`, `brand`, `model`, `year`, `variant?`, `files[]`, `titles[]` → 202 `{ job }` |
| `/api/cars/<car>`          | GET    | `{ car: CarSummary }`                                                                           |
| `/api/cars/<car>`          | DELETE | removes `database/<car>/`; refused for the car being imported                                   |
| `/api/cars/<car>/features` | GET    | `{ sections: CarFeatureSections, engines: CarSpec[], catalog?, year }` (equipment step)         |
| `/api/jobs/<id>`           | GET    | `{ job: ImportJob }`; 404 after a server restart                                                |
| `/api/catalog/*`           | GET    | brand / model / engine lists, see `docs/catalog.md`                                             |

`source=catalog`: `brand` / `model` are catalogue ids; engine is an independent browser choice.
`source=other`: `brand` / `model` are free text, `variant` optional free text.

POST and DELETE call `rejectCrossSite()` (`src/lib/server/guard.ts`), because the local
server has no authentication. A request gets 403 unless:

- `Host` is a loopback name (`localhost`, `127.x.x.x`, `[::1]`) — blocks other devices on
  the network and DNS rebinding; `MANUALS_ALLOW_REMOTE_IMPORT=1` lifts this on trusted
  networks (`/api/system` reports it as `localAccess`, see the wizard's `Availability`);
- and it comes from an app page: `Origin` equal to `Host`, or `Sec-Fetch-Site: same-origin`
  when `Origin` is absent. Requests with neither header (curl, scripts) are rejected.

Reading (all GET routes) works from any device that can reach the server. Error messages
are Polish.

## Server pipeline (`src/lib/server/importer.ts`)

1. `validateImport` (async) — `source=catalog`: `resolveCatalogCar` checks that brand,
   model and year exist in the catalogue → 400 with a Polish message
   otherwise, 503 when the catalogue cannot be read; display names and `catalog` ids
   come from the catalogue. No engine or engine-derived variant is persisted. `source=other`: brand/model
   required (must slugify), integer year in range. For both: 1–10
   documents (`MAX_DOCUMENTS`), each non-empty, `.pdf`/`application/pdf`, ≤ 250 MB
   (`MAX_FILE_BYTES`). Titles default to the file name.
2. Only one job at a time (`runningJob()`; a reservation flag covers the async setup) → 409.
3. A Python with PyMuPDF and Pillow is required (`findPython`) → 503 otherwise (plain
   Polish message pointing to the README).
4. Car id = `uniqueSlug(slugify("<brand> <model> <year>"))` against existing folders
   (`-2`, `-3`, … on collision). Book ids = unique slugs of the titles (`assets` and `RESERVED_BOOK_ROUTES`, i.e.
   `wyposazenie`, reserved).
5. Each upload must start with `%PDF-` (within the first KB); it is written to
   `os.tmpdir()/manual-import-*/<n>/<slug>.pdf` — never inside the repository.
6. The job runs in the background: `extract.py --pdf … --book <bookId> --out
database/.import-<job>/<bookId> --assets database/.import-<job>/assets/<bookId>
--assets-url /media/<car>/<bookId> --title …` per document, sequentially. Progress
   (pages, sections, images) is parsed from stdout; the last log lines are kept.
7. `car.json` (`formatVersion: 1`, brand, model, year, optional free-text variant, `catalog?`,
   `createdAt`, books) is written
   and the staging folder is renamed to `database/<car>/`.
8. `finally`: the temp folder with the PDFs is removed (`pdfsDeleted: true`); on error the
   staging folder is removed too, so a failed import leaves nothing behind.

Jobs are kept in memory on `globalThis` (survive dev hot reloads, not server restarts).
Staging folders start with a dot, so `listCars()` ignores them; they are git-ignored.

## Serving

Images are served by `src/app/media/[...path]/route.ts` from `database/<car>/assets/` —
the car id must match `ID_PATTERN`, every further segment `[a-z0-9._-]` without `..`, only
`.webp`, `.png`, `.jpg`/`.jpeg` are allowed, and the resolved path must stay inside the
assets folder. Responses are cacheable (`max-age=3600, stale-while-revalidate=86400`).

## Limitations

- Content structure quality depends on the PDF layout (headings by font size, warning boxes,
  page footers). Scanned PDFs without a text layer produce only images.
- Equipment detection relies on Polish section and heading titles (`featureRules.ts`);
  manuals in other languages show all content without equipment labels.
- Re-importing the same car creates a new folder; delete the old one on its car page
  ("Usuń to auto", confirmed in an in-app dialog).
