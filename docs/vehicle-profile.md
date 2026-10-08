# Vehicle profile and personalisation

- Definitions: `src/config/vehicle.ts` (`FEATURES`, `FEATURE_GROUPS`, `DEFAULT_PROFILE`,
  `VEHICLE_SUMMARY`).
- Tagging: `src/config/featureRules.ts` (`FEATURE_RULES`, `matchFeatures(book, title)`),
  inherited by sub-sections via `getSectionFeatures` in `src/lib/content.ts`.
- Evaluation: `getAvailability(features, profile)` in `src/lib/availability.ts` →
  `neutral | yours | verify | probable | missing`.
- UI: `AvailabilityBadges` (badges + feature notes, e.g. the OnStar shutdown note),
  `SectionGate` (collapses `missing` sections; "Pokaż tę sekcję" / "Pokaż wszystko"),
  `Sidebar`, `SectionList`, search results and the warnings index grey out or hide
  `missing` items. `/twoje-auto` lists all features, the ones to verify and links to the
  tagged sections. `/ustawienia` edits the profile (stored as overrides).

Default profile highlights: petrol 1.6 Turbo 170 KM with automatic transmission, automatic
high beam, dual-zone electronic climate control, heated + ventilated leather seats, heated
steering wheel and rear window, 3-button folding remote key (keyless: no, to verify), electric
roof (lever + remote), Navi 950 Europe, cruise control + speed limiter (no adaptive cruise),
TC, ESC, electric parking brake, two rear seats, rear camera, front + rear parking sensors,
Advanced Park Assist (probable), side blind spot alert, OnStar buttons (service discontinued),
tyre repair kit. Not present: lane departure warning, traffic sign recognition, Start/Stop and
Eco displays, spare wheel, other infotainment variants. Headlights: AFL and halogen both shown,
marked "do weryfikacji".
