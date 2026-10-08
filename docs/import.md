# Adding cars (PDF import)

Users add their own cars at `/dodaj-auto` without any database: the local Next.js server
converts uploaded PDF manuals into the same JSON + WebP format as the built-in Cascada and
stores them in `database/<car>/`. The PDFs are deleted afterwards. Committing the folder
shares the car with every other checkout of the repository.

## Wizard (`src/app/dodaj-auto/AddCarWizard.tsx`)

1. **Wymagania** — `GET /api/system` returns Node version, platform, the detected Python
   (`command`, `version`, `pymupdf`, `pillow`), whether `scripts/extract.py` exists, whether
   `database/` is writable, the limits and a running job. Missing requirements show install
   commands for the detected platform; a running job can be resumed ("Pokaż postęp").
2. **Auto i dokumenty** — three fields side by side (`sm:grid-cols-3`): brand → model → year.
   Brand/model come from `src/config/carCatalog.ts` with "Inna marka…" / "Inny model…" free
   text; each field is disabled until the previous one is set; years run from
   `maxYear()` (current + 1) down to `MIN_YEAR` (1950). Optional variant text.
   Below, a dashed dropzone (drag & drop or file picker) with a card grid: first-page preview
   (`src/lib/pdfPreview.ts`, pdfjs-dist with its worker, rendered sequentially to limit
   memory), editable title (becomes the book title), page count, size, reorder and remove.
   Non-PDFs, duplicates (name + size + mtime), files over the size limit and files beyond the
   10-document limit are skipped with a message. The target folder
   (`database/<slug of brand model year>/`) is previewed.
3. **Przetwarzanie** — `XMLHttpRequest` multipart POST to `/api/cars` (for upload progress),
   then `GET /api/jobs/<id>` is polled every second; per-document state, counts and the last
   extractor log lines are shown.
4. **Gotowe** — summary, "Otwórz instrukcje auta" (sets `settings.activeCar`), "Dodaj kolejne
   auto", and git commands to share the folder. `router.refresh()` reloads server components so
   the header and lists include the new car.

## API

| Route             | Method | Notes                                                                                 |
| ----------------- | ------ | ------------------------------------------------------------------------------------- |
| `/api/system`     | GET    | environment check (forces Python re-detection)                                        |
| `/api/cars`       | GET    | `{ cars: CarSummary[] }`                                                              |
| `/api/cars`       | POST   | multipart `brand`, `model`, `year`, `variant?`, `files[]`, `titles[]` → 202 `{ job }` |
| `/api/cars/<car>` | GET    | `{ car: CarSummary }`                                                                 |
| `/api/cars/<car>` | DELETE | removes `database/<car>/`; refused for built-in cars and the car being imported       |
| `/api/jobs/<id>`  | GET    | `{ job: ImportJob }`; 404 after a server restart                                      |

POST and DELETE call `rejectCrossSite()` (`src/lib/server/guard.ts`): requests with
`Sec-Fetch-Site: cross-site` or an `Origin` whose host differs from `Host` get 403, because
the local server has no authentication. Error messages are Polish.

## Server pipeline (`src/lib/server/importer.ts`)

1. `validateImport` — brand/model required (must slugify), integer year in range, 1–10
   documents (`MAX_DOCUMENTS`), each non-empty, `.pdf`/`application/pdf`, ≤ 250 MB
   (`MAX_FILE_BYTES`). Titles default to the file name.
2. Only one job at a time (`runningJob()`; a reservation flag covers the async setup) → 409.
3. A Python with PyMuPDF and Pillow is required (`findPython`) → 503 otherwise.
4. Car id = `uniqueSlug(slugify("<brand> <model> <year>"))` against existing folders
   (`-2`, `-3`, … on collision). Book ids = unique slugs of the titles (`assets` reserved).
5. Each upload must start with `%PDF-` (within the first KB); it is written to
   `os.tmpdir()/manual-import-*/<n>/<slug>.pdf` — never inside the repository.
6. The job runs in the background: `extract.py --pdf … --book <bookId> --out
database/.import-<job>/<bookId> --assets database/.import-<job>/assets/<bookId>
--assets-url /media/<car>/<bookId> --title …` per document, sequentially. Progress
   (pages, sections, images) is parsed from stdout; the last log lines are kept.
7. `car.json` (`formatVersion: 1`, brand, model, year, variant, `createdAt`, books) is written
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

- Content structure quality depends on the PDF (the extractor is tuned for Opel manuals:
  headings by font size, warning boxes, page footers). Scanned PDFs without a text layer
  produce only images.
- Imported cars have no feature profile; all sections are shown.
- Re-importing the same car creates a new folder; delete the old one on its car page.
