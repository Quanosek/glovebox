# Storage

All user data is stored in the browser under one localStorage key, `opel-cascada-manual`.
Nothing is sent anywhere.

## Modules (`src/lib/storage/`)

- `schema.ts` — types, `SCHEMA_VERSION`, defaults, `createEmptyData()`.
- `migrations.ts` — `migrate(raw)` runs `MIGRATIONS[v]` step by step up to the current
  version, throws `UnsupportedVersionError` for data from a newer app version, then
  `sanitize()` drops/repairs invalid entries. Also `parseImport()` and `mergeData()`.
- `store.ts` — `AppStore` (in-memory snapshot + persistence + listeners), `getStore()`
  browser singleton (listens to the `storage` event for cross-tab sync), `newId()`.
- `hooks.ts` — `useAppData()`, `useHydrated()`, `useVehicleProfile(carId?)`,
  `setFeatureState(car, id, state | null)`, `setVehicleProfile(car, profile)`,
  `useActiveCar(cars)`, `setActiveCar(id)`, `updateData(fn)`, `recordReading(entry)`,
  `withoutBookmark(data, id)`, `saveReminder(r)`,
  `deleteReminder(id)`.

`updateData` takes a pure function `(data) => newData`; never mutate the snapshot.

## Schema (version 7)

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
  entry can be initialized from a legacy shared `car.spec` once for an owned car. New imports
  never write engine selections into `car.json`. Valid fuel kinds, finite positive numbers
  and bounded labels/codes are checked during sanitization. `useCarEngine`, `setCarEngine`
  and `initializeCarEngine` handle these choices. Changing an engine refreshes probable
  equipment suggestions but preserves explicit owner choices.
- `history` (v5) holds up to `HISTORY_LIMIT` (12) recently read sections, newest first, one
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
  of the car); there is no separate favourites list. A `settings.favorites` object left by an
  earlier development build is dropped by `sanitize`.
- `lastRead.scrollY` is restored only when the user clicks "Kontynuuj czytanie"
  (a one-shot sessionStorage flag, `opel-cascada-manual:restore-scroll`).

## Migrations

- `1 → 2`: keeps data from the former single-car version associated with its original
  `opel-cascada-2016` car id, rewrites the old `/instrukcja/…` and `/navi-950/…` links, rebuilds
  bookmark ids as `${car}:${book}:${sectionId}` and sets `activeCar` when the user had data.

- `2 → 3`: the old single-car `settings.vehicle` profile moves to
  `settings.vehicles["opel-cascada-2016"]`, with renamed feature ids mapped; the old
  feature defaults themselves are not copied. This only preserves data created by the retired
  single-car version; current installations have no preset vehicle or equipment.
- `3 → 4`: `settings.ownedCars` is initialized from cars already used in this profile (active car,
  equipment, highlights, bookmarks or last-read location), rather than claiming every car in the
  manuals library.
- `4 → 5`: adds `history` (seeded with the `lastRead` section, without thumbnail), empty
  `reminders`.
- `5 → 6`: adds `eventDate` to reminders; existing due dates are preserved.
- `6 → 7`: adds empty per-car engine choices, preserving equipment and all other data.
  `EngineProfileInitializer` transfers legacy shared selections only for owned cars with
  no local choice; an explicit unknown choice is never overwritten.
  New library assignments set an explicit unknown choice, so another owner's legacy manual
  metadata cannot become their engine selection.

Migrations run in memory on load; the upgraded shape is written on the next change.

## Adding a migration

1. Bump `SCHEMA_VERSION` in `schema.ts` and update the types.
2. Add `MIGRATIONS[previousVersion] = (data) => ({ ...data, /* changes */, version: next })`.
3. Update `sanitize()` for new fields.
4. Add a test in `src/lib/__tests__/storage.test.ts` with a stored object of the old version.

## Errors

- Write failures (e.g. quota exceeded) are kept in `store.lastError` and shown on `/ustawienia`.
- Unparseable or invalid stored data is copied to `opel-cascada-manual:backup-<timestamp>`
  and the app starts with empty data.

## Backup

- Export: `{ app: "opel-cascada-manual", exportedAt, data }` (pretty-printed JSON download).
- Import: export file or bare `AppData`; `merge` mode keeps current data and takes the newer
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

- `opel-cascada-manual:offline:v7` — status of offline car copies (`src/lib/offline.ts`). It is
  derived state (rebuilt on the next car visit), deliberately not part of `AppData`, the
  export file or the schema version.
  Its namespace follows the schema version so older app bundles are not treated as current
  offline copies. Obsolete unversioned statuses are ignored.
- `opel-cascada-manual:notifications` — last due date notified per reminder. Native browser
  notifications are optional and checked while the app is open; they are not scheduled while
  the app is closed.
- sessionStorage `opel-cascada-manual:reader-navigation` — per-tab trails of manual pages
  per car, pending back targets and native-history reading boundaries. Not user annotations,
  not part of the backup or schema. Storage failures are logged and the current tab retains
  an in-memory trail.

## Layout hint cookie

- `ocm-layout` (`src/lib/storage/hint.ts`) is a small JSON summary of the browser data,
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
