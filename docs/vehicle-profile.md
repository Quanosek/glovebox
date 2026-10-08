# Vehicle equipment (per-car profiles)

Owner's manuals describe optional equipment that only some versions have. The app tags the
content with generic features and lets the owner mark, **per car**, what their car has. No
car ships with presets: a feature without a stored state is neutral and its content is shown
normally.

## Definitions

- `src/config/vehicle.ts` — `FEATURES` (generic, any brand: id, group, Polish label,
  optional Polish note), `FEATURE_GROUPS`, `FEATURE_BY_ID`, `RENAMED_FEATURES` (old ids,
  migrated in storage) and `suggestFromSpec(spec)`.
- `FeatureState = { status: "has" | "no", certainty }`: `confirmed` = chosen by the owner,
  `probable` = suggestion ("prawdopodobnie", shown as "podpowiedź – potwierdź" in the
  editor), `verify` = "do weryfikacji" (older data only).
- `suggestFromSpec` derives `probable` states from the engine picked from the official
  catalogue (`docs/catalog.md`), only what the fuel type implies (diesel, hybrid, plug-in,
  CNG, …; LPG stays open because it is often fitted later).

## Tagging (`src/config/featureRules.ts`, `src/lib/content.ts`)

- `FEATURE_RULES`: Polish regexes on titles (`pattern`, optional `exclude`, optional
  `book`), matched by `matchFeatures(book, title)`. Rules are generic and run for every car
  on the server at render time — editing them needs no re-extraction. Keep rules precise:
  check that new patterns do not hit unrelated phrases (e.g. "Połączenie alarmowe" is not an
  alarm system).
- **Section level** — `getSectionFeatures(ctx, id)`: tags of the section title, inherited by
  sub-sections.
- **Heading level** — `getFeatureTree(ctx, blocks, inherited)`: most equipment is described
  under headings inside a section (the extractor splits pages only up to level 2). A heading
  that mentions features not already inherited starts a part that runs until the next
  heading of the same or higher level; parts nest.
- `getFeatureSections(car)` — every tagged section/heading with its link (`href#bN`),
  grouped by feature; served by `GET /api/cars/<car>/features` together with `car.spec`.
  Only features found here are offered in the editor.

## Evaluation and UI

- `getAvailability(features, profile)` (`src/lib/availability.ts`) → `neutral | yours |
verify | probable | missing`; unset features are skipped, any `no` → `missing`.
- `BlockRenderer` renders the feature tree: gated headings get `AvailabilityBadges` and a
  `SectionGate compact`; whole sections use `SectionGate` ("Pokaż tę sekcję" / "Pokaż
  wszystko"). Hidden content stays in the DOM so anchoring and in-page links keep working.
- `Sidebar`, `SectionList`, search and the warnings index grey out or hide `missing` items,
  each with the profile of the item's car.
- `EquipmentEditor` (`src/components/EquipmentEditor.tsx`) — grouped checklist of the
  detected features with "Mam" / "Nie mam" / "Nie wiem", up to 5 links to the sections that
  describe each feature, "Uzupełnij na podstawie silnika" (`suggestFromSpec`) and "Wyczyść
  wszystko". Used on `/auto/<car>/wyposazenie` and in step 3 of the wizard (pre-filled with
  suggestions when the car has no profile yet). `/ustawienia` lists all cars with links.

## Storage

`settings.vehicles[carId][featureId]` (schema v3, `docs/storage.md`). Hooks:
`useVehicleProfile(carId?)` (falls back to the car in the `/auto/<id>` URL),
`setFeatureState(car, id, state | null)`, `setVehicleProfile(car, profile)`. Deleting a car
removes its profile.

## Adding a feature

Add it to `FEATURES`, add a rule to `FEATURE_RULES` (and to `suggestFromSpec` if the engine
data implies it), add a case to `src/lib/__tests__/availability.test.ts`, run `pnpm test`.
