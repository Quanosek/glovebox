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

## Schema (version 6)

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
- UI labels: "Pobierz kopię zapasową" (export), "Wczytaj kopię z pliku…" (import).
- "Usuń wszystkie dane" removes the key; "Usuń instrukcje zapisane offline" deletes the Cache
  API caches (see `docs/offline.md`). Destructive actions are confirmed with `confirmDialog`
  (`docs/ui.md`).

## Other keys

- `opel-cascada-manual:offline` — status of offline car copies (`src/lib/offline.ts`). It is
  derived state (rebuilt on the next car visit), deliberately not part of `AppData`, the
  export file or the schema version.
- `opel-cascada-manual:notifications` — last due date notified per reminder. Native browser
  notifications are optional and checked while the app is open; they are not scheduled while
  the app is closed.

## Layout hint cookie

- `ocm-layout` (`src/lib/storage/hint.ts`) is a small JSON summary of the browser data,
  written by `ClientEffects` after hydration on every data or offline-state change
  (`Path=/; Max-Age=31536000; SameSite=Strict`, kept below ~3.6 kB). It holds only what the
  first paint needs: active and owned car ids, font size, profile name, the four profile
  counters, the "Czytaj dalej" card (title, link, preformatted date, thumbnail), the number of
  "Ostatnio czytane" rows, which recent highlights have a comment, cars with an offline copy,
  favourites-bar keys (bookmarks, at most six) and own reminders per car, and the due reminder count. No notes,
  highlight text or comments.
- The root layout reads it with `cookies()` (`parseHint` validates every field, ids with
  `isValidId`, links must start with `/auto/` and thumbnails with `/media/`), sets
  `<html data-font-size>` and provides it through `LayoutHintProvider`
  (`src/lib/storage/hintContext.tsx`). Client components use `useLayoutHint()` only while
  `useHydrated()` is false; `useActiveCar` falls back to `hint.activeCar`, so the header shows
  the car logo from the first paint.
- It is derived state, never trusted for anything but layout, not part of `AppData`, the
  export file or the schema version. A missing or stale cookie only costs one layout change.
