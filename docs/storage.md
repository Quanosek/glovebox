# Storage

All user data is stored in the browser under one localStorage key, `glovebox`.
Nothing is sent anywhere.

Glovebox starts with schema 1 and its own browser/cache namespaces. Builds preceding
Glovebox are not migrated and their exports are not accepted. Manuals in `database/`
remain readable and can be assigned to the new browser profile.

## Modules (`src/lib/storage/`)

- `schema.ts` — types, `SCHEMA_VERSION`, defaults, `createEmptyData()`.
- `data.ts` — `parseData(raw)` requires the current integer schema version, throws
  `UnsupportedVersionError` for any other version, then `sanitize()` drops/repairs
  invalid entries. Also `parseImport()`, `mergeData()` and `historyKey()`.
- `store.ts` — `AppStore` (in-memory snapshot + persistence + listeners), `getStore()`
  browser singleton (listens to the `storage` event for cross-tab sync), `newId()`.
- `hooks.ts` — `useAppData()`, `useHydrated()`, `useVehicleProfile(carId?)`,
  `setFeatureState(car, id, state | null)`, `setVehicleProfile(car, profile)`,
  `useActiveCar(cars)`, `setActiveCar(id)`, `updateData(fn)`, `recordReading(entry)`,
  `withoutBookmark(data, id)`, `saveReminder(r)`,
  `deleteReminder(id)`.

`updateData` takes a pure function `(data) => newData`; never mutate the snapshot.

## Schema (version 1)

See `AGENTS.md` → Storage schema. Notes:

- Highlights, bookmarks and `lastRead` carry `car` (a `database/` car id) and `book` (a book
  id inside that car). Views filter by car and label entries with the car/book names from
  `listCarSummaries()`; entries of a car that was deleted stay in storage and keep their ids.
- `settings.activeCar` is the car picked on the profile; the URL (`/auto/<id>`) wins while
  reading (`useActiveCar`). `settings.profileName` is the local profile's display name.
- `settings.ownedCars` lists the cars assigned to this browser profile. Other readable cars in
  `database/` remain available on `/dodaj-auto` and can be added without re-importing manuals.
  Removing a car from the profile does not delete its manuals or associated notes.

- `settings.vehicles[carId]` is the equipment profile of one car (`docs/vehicle-profile.md`):
  only features the owner set (or accepted suggestions); there are no defaults. `sanitize`
  keeps known feature ids and valid states only.
- `settings.engines[carId]` holds the owner's selected `CarSpec` (`fuel`, displacement,
  power, label, optional manufacturer `code`). `null` means explicitly unknown; a missing
  entry means no choice yet. New assignments explicitly set `null`. The importer
  never writes engine selections into `car.json`. Valid fuel kinds, finite positive numbers
  and bounded labels/codes are checked during sanitization. `useCarEngine`, `setCarEngine`
  handle these choices. Changing an engine refreshes probable
  equipment suggestions but preserves explicit owner choices.
- `history` holds up to `HISTORY_LIMIT` (12) recently read sections, newest first, one
  entry per `car:book:sectionId` (`historyKey`). `ReadingTracker` calls `recordReading` with the
  section's first illustration as `thumb` (only `/media/…` URLs survive `sanitize`; links must
  start with `/auto/`). The profile shows it under "Ostatnio czytane".
- `reminders` are the owner's reminders per car: `kind` (`inspection` = yearly technical
  inspection, `insurance` = OC insurance, `custom` = own entry; unknown values become
  `custom`), `title` (required, ≤ 120 characters), optional `dueDate` (`YYYY-MM-DD`) and
  `dueKm` (0–5 000 000), `eventDate` (last inspection or OC policy start), `done`. Invalid dates
  or mileages become `null`. Fixed reminders calculate the next deadline one year after
  `eventDate`. `inspection` and
  `insurance` have one entry per car with the fixed id `${kind}:${car}` (`fixedReminderId`;
  `sanitize` rewrites their ids, so duplicates collapse and merging matches them).
- The car page "Ulubione" bar is derived from `bookmarks` (the newest `FAVORITES_LIMIT` = 6
  of the car); there is no separate favourites list.
- `lastRead.scrollY` is restored only when the user clicks "Kontynuuj czytanie"
  (a one-shot sessionStorage flag, `glovebox:restore-scroll`).

## Changing the schema

Update `SCHEMA_VERSION`, the types and validation in `data.ts` together. Add tests of the
supported format and rejection of incompatible versions. There is no migration chain.

## Errors

- Write failures (e.g. quota exceeded) are kept in `store.lastError` and shown on `/ustawienia`.
- Unparseable or invalid stored data is copied to `glovebox:backup-<timestamp>`
  and the app starts with empty data.

## Backup

- Export: `{ app: "glovebox", exportedAt, data }` (pretty-printed JSON download named
  `glovebox-kopia-YYYY-MM-DD.json`).
- Import requires a Glovebox export wrapper and schema version 1; bare objects, files from
  other apps and incompatible versions are rejected before changing the current profile.
  `merge` mode keeps current data and takes the newer
  entry per id (`updatedAt`/`createdAt`), notebook pages and bookmarks are merged by id,
  equipment profiles per car and feature (the current state wins), history per section
  (newest `at` wins), reminders by id (newest `updatedAt` wins);
  `replace` mode overwrites everything.
  Engine choices are merged per car (the current choice, including `null`, wins).
- UI labels: "Pobierz kopię zapasową" (export), "Wczytaj kopię z pliku…" (import).
- "Usuń wszystkie dane" removes the key; "Usuń instrukcje zapisane offline" deletes the Cache
  API caches (see `docs/offline.md`). Destructive actions are confirmed with `confirmDialog`
  (`docs/ui.md`).

## Other keys

- `glovebox:offline:v1` — status of offline car copies (`src/lib/offline.ts`). It is
  derived state (rebuilt on the next car visit), deliberately not part of `AppData`, the
  export file or the schema version.
  Its namespace follows the schema version so older app bundles are not treated as current
  offline copies.
- `glovebox:notifications` — last due date notified per reminder. Native browser
  notifications are optional and checked while the app is open; they are not scheduled while
  the app is closed.
- sessionStorage `glovebox:reader-navigation` — per-tab trails of manual pages
  per car, pending back targets and native-history reading boundaries. Not user annotations,
  not part of the backup or schema. Storage failures are logged and the current tab retains
  an in-memory trail.

## Layout hint cookie

- `glovebox-layout` (`src/lib/storage/hint.ts`) is a small JSON summary of the browser data,
  written by `ClientEffects` after hydration on every data or offline-state change
  (`Path=/; Max-Age=31536000; SameSite=Strict`, kept below ~3.6 kB). It holds only what the
  first paint needs: active and owned car ids, font size, profile name, the four profile
  counters, the "Czytaj dalej" card (title, link, preformatted date, thumbnail), the number of
  "Ostatnio czytane" rows, which recent highlights have a comment, cars with an offline copy,
  favourites-bar keys (bookmarks, at most six) and own reminders per car, and the due reminder count. No notes,
  highlight text or comments.
- Engine choices and `showUnavailable` are mirrored for stable first-paint car chips,
  driver facts and engine tables. The oversized-cookie fallback retains only the active
  car's engine before falling back to the empty hint.
- The root layout reads it with `cookies()` (`parseHint` validates every field, ids with
  `isValidId`, links must start with `/auto/` and thumbnails with `/media/`), sets
  `<html data-font-size>` and provides it through `LayoutHintProvider`
  (`src/lib/storage/hintContext.tsx`). Client components use `useLayoutHint()` only while
  `useHydrated()` is false; `useActiveCar` falls back to `hint.activeCar`, so the header shows
  the car logo from the first paint.
- It is derived state, never trusted for anything but layout, not part of `AppData`, the
  export file or the schema version. A missing or stale cookie only costs one layout change.
