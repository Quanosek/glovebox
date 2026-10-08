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
- `hooks.ts` — `useAppData()`, `useHydrated()`, `useVehicleProfile()`, `updateData(fn)`.

`updateData` takes a pure function `(data) => newData`; never mutate the snapshot.

## Schema (version 1)

See `AGENTS.md` → Storage schema. Notes:

- `settings.vehicle` contains only overrides of `DEFAULT_PROFILE`.
- `lastRead.scrollY` is restored only when the user clicks "Kontynuuj czytanie"
  (a one-shot sessionStorage flag, `opel-cascada-manual:restore-scroll`).

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
  entry per id (`updatedAt`/`createdAt`), notebook pages and bookmarks are merged by id;
  `replace` mode overwrites everything.
- "Usuń wszystkie dane" removes the key; "Wyczyść pamięć offline" deletes the Cache API caches.
