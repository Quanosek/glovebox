/**
 * Vehicle profile of the owner's Opel Cascada MY16.
 *
 * The manuals describe every variant. Each feature below has a default
 * status for this particular car; content sections are tagged with features
 * by the rules in `featureRules.ts`. The owner can override every status on
 * the settings page (stored in localStorage, see `src/lib/storage`).
 *
 * UI strings are Polish, identifiers English.
 */

export type FeatureStatus = "has" | "no";
/** confirmed = owner confirmed, verify = "do weryfikacji", probable = "prawdopodobnie". */
export type FeatureCertainty = "confirmed" | "verify" | "probable";

export interface FeatureState {
  status: FeatureStatus;
  certainty: FeatureCertainty;
}

export interface FeatureDefinition {
  id: string;
  group: FeatureGroupId;
  /** Polish label. */
  label: string;
  /** Optional Polish note displayed on tagged sections. */
  note?: string;
  default: FeatureState;
}

export type FeatureGroupId =
  | "drive"
  | "lights"
  | "comfort"
  | "access"
  | "assist"
  | "infotainment"
  | "wheels";

export const FEATURE_GROUPS: Record<FeatureGroupId, string> = {
  drive: "Napęd i układ jezdny",
  lights: "Oświetlenie",
  comfort: "Komfort i klimatyzacja",
  access: "Kluczyk, zamki i dach",
  assist: "Systemy wspomagające kierowcę",
  infotainment: "Multimedia i łączność",
  wheels: "Koła i opony",
};

const has = (certainty: FeatureCertainty = "confirmed"): FeatureState => ({
  status: "has",
  certainty,
});
const no = (certainty: FeatureCertainty = "confirmed"): FeatureState => ({
  status: "no",
  certainty,
});

export const FEATURES = [
  // Drive
  { id: "engine.petrol16Turbo", group: "drive", label: "Silnik benzynowy 1.6 Turbo 170 KM (125 kW)", default: has() },
  { id: "engine.otherPetrol", group: "drive", label: "Inne silniki benzynowe (1.4 Turbo, 1.6 SIDI 200 KM)", default: no() },
  { id: "engine.diesel", group: "drive", label: "Silnik wysokoprężny (diesel), filtr cząstek stałych", default: no() },
  { id: "engine.lpg", group: "drive", label: "Instalacja LPG", default: no() },
  { id: "transmission.automatic", group: "drive", label: "Automatyczna skrzynia biegów", default: has() },
  { id: "transmission.manual", group: "drive", label: "Manualna skrzynia biegów", default: no() },
  { id: "drive.startStop", group: "drive", label: "System Start/Stop (autostop) i wskazania Eco", default: no() },
  { id: "drive.ecoDisplay", group: "drive", label: "Wskaźnik / tryb Eco, wskazówki zmiany biegów", default: no() },
  { id: "drive.cruiseControl", group: "drive", label: "Tempomat", default: has() },
  { id: "drive.adaptiveCruise", group: "drive", label: "Adaptacyjny tempomat", default: no() },
  { id: "drive.speedLimiter", group: "drive", label: "Ogranicznik prędkości", default: has() },
  { id: "drive.tractionControl", group: "drive", label: "Układ kontroli trakcji (TC)", default: has() },
  { id: "drive.esc", group: "drive", label: "Elektroniczny układ stabilizacji toru jazdy (ESC)", default: has() },
  { id: "drive.electricParkingBrake", group: "drive", label: "Elektryczny hamulec postojowy", default: has() },
  { id: "drive.flexRide", group: "drive", label: "Adaptacyjne zawieszenie FlexRide (tryb Sport/Tour)", default: no("verify") },
  { id: "drive.towbar", group: "drive", label: "Hak holowniczy", default: no("verify") },

  // Lights
  { id: "lights.highBeamAssist", group: "lights", label: "Automatyczne światła drogowe (asystent świateł drogowych)", default: has() },
  { id: "lights.afl", group: "lights", label: "Adaptacyjne reflektory AFL (biksenonowe, doświetlanie zakrętów)", note: "Typ reflektorów nie jest znany (AFL czy halogenowe) — pokazujemy oba warianty.", default: has("verify") },
  { id: "lights.halogen", group: "lights", label: "Reflektory halogenowe", note: "Typ reflektorów nie jest znany (AFL czy halogenowe) — pokazujemy oba warianty.", default: has("verify") },
  { id: "lights.automatic", group: "lights", label: "Automatyczne sterowanie światłami (czujnik zmierzchu)", default: has("probable") },

  // Comfort
  { id: "climate.electronic", group: "comfort", label: "Dwustrefowa automatyczna klimatyzacja (elektroniczna)", default: has() },
  { id: "climate.manual", group: "comfort", label: "Klimatyzacja manualna / układ ogrzewania i wentylacji", default: no() },
  { id: "seats.leather", group: "comfort", label: "Skórzana tapicerka", default: has() },
  { id: "seats.heated", group: "comfort", label: "Podgrzewane fotele przednie", default: has() },
  { id: "seats.ventilated", group: "comfort", label: "Wentylowane fotele przednie", default: has() },
  { id: "seats.rearTwo", group: "comfort", label: "Dwa miejsca z tyłu rozdzielone uchwytami na kubki", default: has() },
  { id: "steeringWheel.heated", group: "comfort", label: "Podgrzewana kierownica", default: has() },
  { id: "rearWindow.heated", group: "comfort", label: "Ogrzewanie tylnej szyby", default: has() },
  { id: "comfort.rainSensor", group: "comfort", label: "Czujnik deszczu (automatyczne wycieraczki)", default: has("verify") },
  { id: "comfort.windDeflector", group: "comfort", label: "Wiatrochron", default: no("verify") },

  // Access
  { id: "key.remote", group: "access", label: "Kluczyk składany z pilotem (3 przyciski)", default: has() },
  { id: "key.keyless", group: "access", label: "System Keyless Open / przycisk Start/Stop", note: "Zakładamy kluczyk w stacyjce — do weryfikacji.", default: no("verify") },
  { id: "roof.electric", group: "access", label: "Elektrycznie składany dach (srebrna dźwignia w kabinie)", default: has() },
  { id: "roof.remote", group: "access", label: "Składanie dachu pilotem (dłuższe przytrzymanie przycisku)", default: has() },
  { id: "access.alarm", group: "access", label: "Alarm przeciwkradzieżowy", default: has("verify") },

  // Assist
  { id: "assist.rearCamera", group: "assist", label: "Kamera cofania", default: has() },
  { id: "assist.parkSensorsFront", group: "assist", label: "Czujniki parkowania z przodu", default: has() },
  { id: "assist.parkSensorsRear", group: "assist", label: "Czujniki parkowania z tyłu", default: has() },
  { id: "assist.advancedParkAssist", group: "assist", label: "Zaawansowany asystent parkowania (Advanced Park Assist)", note: "Prawdopodobnie w wyposażeniu — do potwierdzenia.", default: has("probable") },
  { id: "assist.sideBlindSpot", group: "assist", label: "Ostrzeganie o martwym polu (w lusterkach)", default: has() },
  { id: "assist.laneDeparture", group: "assist", label: "Ostrzeganie o niezamierzonej zmianie pasa ruchu", default: no() },
  { id: "assist.trafficSign", group: "assist", label: "Rozpoznawanie znaków drogowych (Opel Eye)", default: no() },
  { id: "assist.forwardCollision", group: "assist", label: "Ostrzeganie przed kolizją / odległość od poprzedzającego pojazdu", default: no("verify") },

  // Infotainment
  { id: "infotainment.navi950", group: "infotainment", label: "Navi 950 IntelliLink (Europe) z nawigacją", default: has() },
  { id: "infotainment.otherVariants", group: "infotainment", label: "Inne systemy (R 4.0, Navi 4.0, CD 600, Navi 650, CD 300…)", default: no() },
  { id: "infotainment.infinity", group: "infotainment", label: "Nagłośnienie Infinity", default: has("verify") },
  { id: "infotainment.onstar", group: "infotainment", label: "OnStar (przyciski w lusterku wstecznym)", note: "Usługa OnStar nie działa już w Europie (wyłączona) — przyciski pozostają nieaktywne.", default: has() },

  // Wheels
  { id: "wheels.repairKit", group: "wheels", label: "Zestaw naprawczy do opon (uszczelniacz + kompresor)", default: has() },
  { id: "wheels.spare", group: "wheels", label: "Koło zapasowe / dojazdowe", default: no() },
  { id: "wheels.tpms", group: "wheels", label: "System monitorowania ciśnienia w oponach", default: has("probable") },
] as const satisfies readonly FeatureDefinition[];

export type FeatureId = (typeof FEATURES)[number]["id"];

export const FEATURE_BY_ID: Record<string, FeatureDefinition> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f]),
);

export type VehicleProfile = Record<string, FeatureState>;

export const DEFAULT_PROFILE: VehicleProfile = Object.fromEntries(
  FEATURES.map((f) => [f.id, f.default]),
);

/** Static facts shown on the "Twoje auto" page. */
export const VEHICLE_SUMMARY = {
  model: "Opel Cascada",
  modelYear: "MY16 (2016)",
  engine: "1.6 Turbo benzyna, 170 KM (125 kW)",
  transmission: "automatyczna",
  infotainment: "Navi 950 IntelliLink Europe",
};

/** Merges stored overrides over defaults (unknown ids are ignored). */
export function resolveProfile(overrides: Partial<VehicleProfile> | undefined): VehicleProfile {
  const out: VehicleProfile = { ...DEFAULT_PROFILE };
  if (!overrides) return out;
  for (const [id, state] of Object.entries(overrides)) {
    if (id in out && state) out[id] = state;
  }
  return out;
}
