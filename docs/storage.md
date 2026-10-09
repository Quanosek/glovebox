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
  `useActiveCar(cars)`, `setActiveCar(id)`, `updateData(fn)`.

`updateData` takes a pure function `(data) => newData`; never mutate the snapshot.

## Schema (version 4)

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
  equipment profiles per car and feature (the current state wins);
  `replace` mode overwrites everything.
- UI labels: "Pobierz kopię zapasową" (export), "Wczytaj kopię z pliku…" (import).
- "Usuń wszystkie dane" removes the key; "Usuń instrukcje zapisane offline" deletes the Cache
  API caches (see `docs/offline.md`). Destructive actions are confirmed with `confirmDialog`
  (`docs/ui.md`).

## Other keys

- `opel-cascada-manual:offline` — status of offline car copies (`src/lib/offline.ts`). It is
  derived state (rebuilt on the next car visit), deliberately not part of `AppData`, the
  export file or the schema version.
