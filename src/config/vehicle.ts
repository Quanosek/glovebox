import type { CarSpec } from "@/lib/catalog";

/**
 * Optional equipment that owner's manuals describe for some versions only.
 *
 * The list is generic (any brand). Content sections are tagged with these
 * features by the title rules in `featureRules.ts`; the owner marks for each
 * car what it has ("Mam" / "Nie mam" / "Nie wiem") on the car's equipment
 * page or in the last step of the "Dodaj auto" wizard. Nothing is assumed:
 * a feature without a stored state is neutral. Profiles are stored per car
 * in localStorage (`settings.vehicles`, see `src/lib/storage`).
 *
 * UI strings are Polish, identifiers English.
 */

export type FeatureStatus = "has" | "no";
/**
 * confirmed = set by the owner, probable = suggested from the engine data
 * ("prawdopodobnie").
 */
export type FeatureCertainty = "confirmed" | "probable";

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
  drive: "Silnik, napęd i jazda",
  lights: "Oświetlenie",
  comfort: "Komfort i klimatyzacja",
  access: "Kluczyk, zamki i dach",
  assist: "Systemy wspomagające kierowcę",
  infotainment: "Multimedia i łączność",
  wheels: "Koła i opony",
};

export const FEATURES = [
  // Drive
  {
    id: "engine.diesel",
    group: "drive",
    label: "Silnik wysokoprężny (diesel)",
  },
  { id: "engine.lpg", group: "drive", label: "Instalacja gazowa LPG" },
  { id: "engine.cng", group: "drive", label: "Zasilanie gazem ziemnym CNG" },
  { id: "engine.hybrid", group: "drive", label: "Napęd hybrydowy" },
  {
    id: "engine.plugin",
    group: "drive",
    label: "Ładowanie z gniazdka (auto elektryczne lub hybryda plug-in)",
  },
  {
    id: "transmission.automatic",
    group: "drive",
    label: "Automatyczna skrzynia biegów",
  },
  {
    id: "transmission.manual",
    group: "drive",
    label: "Manualna skrzynia biegów",
  },
  {
    id: "drive.allWheel",
    group: "drive",
    label: "Napęd na cztery koła (4x4)",
  },
  {
    id: "drive.startStop",
    group: "drive",
    label: "System Start/Stop (automatyczne wyłączanie silnika)",
  },
  {
    id: "drive.ecoDisplay",
    group: "drive",
    label: "Tryb Eco i wskazówki zmiany biegów",
  },
  { id: "drive.cruiseControl", group: "drive", label: "Tempomat" },
  {
    id: "drive.adaptiveCruise",
    group: "drive",
    label: "Adaptacyjny tempomat",
  },
  {
    id: "drive.speedLimiter",
    group: "drive",
    label: "Ogranicznik prędkości",
  },
  {
    id: "drive.tractionControl",
    group: "drive",
    label: "Układ kontroli trakcji",
  },
  {
    id: "drive.esc",
    group: "drive",
    label: "Elektroniczny układ stabilizacji toru jazdy (ESC/ESP)",
  },
  {
    id: "drive.electricParkingBrake",
    group: "drive",
    label: "Elektryczny hamulec postojowy",
  },
  {
    id: "drive.flexRide",
    group: "drive",
    label: "Adaptacyjne zawieszenie i tryby jazdy",
  },
  { id: "drive.towbar", group: "drive", label: "Hak holowniczy" },

  // Lights
  {
    id: "lights.highBeamAssist",
    group: "lights",
    label: "Asystent świateł drogowych",
  },
  {
    id: "lights.afl",
    group: "lights",
    label: "Reflektory adaptacyjne, ksenonowe lub LED (doświetlanie zakrętów)",
  },
  { id: "lights.halogen", group: "lights", label: "Reflektory halogenowe" },
  {
    id: "lights.automatic",
    group: "lights",
    label: "Automatyczne włączanie świateł (czujnik zmierzchu)",
  },

  // Comfort
  {
    id: "climate.electronic",
    group: "comfort",
    label: "Klimatyzacja automatyczna",
  },
  {
    id: "climate.manual",
    group: "comfort",
    label: "Klimatyzacja manualna lub sam nawiew",
  },
  {
    id: "seats.heated",
    group: "comfort",
    label: "Podgrzewane fotele",
  },
  {
    id: "seats.ventilated",
    group: "comfort",
    label: "Wentylowane fotele",
  },
  {
    id: "steeringWheel.heated",
    group: "comfort",
    label: "Podgrzewana kierownica",
  },
  {
    id: "rearWindow.heated",
    group: "comfort",
    label: "Ogrzewanie tylnej szyby",
  },
  {
    id: "comfort.rainSensor",
    group: "comfort",
    label: "Czujnik deszczu (automatyczne wycieraczki)",
  },
  {
    id: "comfort.auxHeater",
    group: "comfort",
    label: "Ogrzewanie postojowe",
  },
  {
    id: "comfort.sunroof",
    group: "comfort",
    label: "Szyberdach lub dach panoramiczny",
  },
  {
    id: "comfort.windDeflector",
    group: "comfort",
    label: "Wiatrochron",
  },

  // Access
  {
    id: "key.keyless",
    group: "access",
    label: "Dostęp bezkluczykowy i uruchamianie przyciskiem",
  },
  {
    id: "roof.remote",
    group: "access",
    label: "Składanie dachu pilotem",
  },
  {
    id: "access.alarm",
    group: "access",
    label: "Alarm przeciwkradzieżowy",
  },

  // Assist
  { id: "assist.rearCamera", group: "assist", label: "Kamera cofania" },
  {
    id: "assist.camera360",
    group: "assist",
    label: "Kamery 360° (widok z góry)",
  },
  {
    id: "assist.parkSensors",
    group: "assist",
    label: "Czujniki parkowania",
  },
  {
    id: "assist.advancedParkAssist",
    group: "assist",
    label: "Asystent parkowania (samodzielne parkowanie)",
  },
  {
    id: "assist.sideBlindSpot",
    group: "assist",
    label: "Ostrzeganie o martwym polu",
  },
  {
    id: "assist.laneDeparture",
    group: "assist",
    label: "Asystent pasa ruchu",
  },
  {
    id: "assist.trafficSign",
    group: "assist",
    label: "Rozpoznawanie znaków drogowych",
  },
  {
    id: "assist.forwardCollision",
    group: "assist",
    label: "Ostrzeganie przed kolizją i hamowanie awaryjne",
  },
  {
    id: "assist.headUp",
    group: "assist",
    label: "Wyświetlacz przezierny (na szybie)",
  },

  // Infotainment
  {
    id: "infotainment.navigation",
    group: "infotainment",
    label: "Nawigacja",
  },
  {
    id: "infotainment.phoneProjection",
    group: "infotainment",
    label: "Apple CarPlay lub Android Auto",
  },
  {
    id: "infotainment.dab",
    group: "infotainment",
    label: "Radio cyfrowe DAB",
  },
  {
    id: "infotainment.voice",
    group: "infotainment",
    label: "Sterowanie głosowe",
  },
  {
    id: "infotainment.premiumAudio",
    group: "infotainment",
    label: "Nagłośnienie premium (np. Infinity, Bose, Harman Kardon)",
  },
  {
    id: "infotainment.onstar",
    group: "infotainment",
    label: "OnStar",
    note: "Usługa OnStar nie działa już w Europie – przyciski pozostają nieaktywne.",
  },

  // Wheels
  {
    id: "wheels.repairKit",
    group: "wheels",
    label: "Zestaw naprawczy do opon (uszczelniacz i kompresor)",
  },
  {
    id: "wheels.spare",
    group: "wheels",
    label: "Koło zapasowe lub dojazdowe",
  },
  {
    id: "wheels.tpms",
    group: "wheels",
    label: "Kontrola ciśnienia w oponach",
  },
] as const satisfies readonly FeatureDefinition[];

export type FeatureId = (typeof FEATURES)[number]["id"];

export const FEATURE_BY_ID: Record<string, FeatureDefinition> =
  Object.fromEntries(FEATURES.map((f) => [f.id, f]));

/** Stored states of one car, keyed by feature id (unset = unknown). */
export type VehicleProfile = Record<string, FeatureState>;

export const EXCLUSIVE_FEATURES: readonly (readonly FeatureId[])[] = [
  ["transmission.automatic", "transmission.manual"],
  ["climate.electronic", "climate.manual"],
];

/** Infer absent alternatives without storing them as the owner's choices. */
export function withExclusiveFeatures(profile: VehicleProfile): VehicleProfile {
  const result = { ...profile };
  for (const group of EXCLUSIVE_FEATURES) {
    const present = group.filter((id) => profile[id]?.status === "has");
    if (present.length !== 1) continue;
    for (const id of group) {
      if (id !== present[0] && profile[id]?.certainty !== "confirmed")
        result[id] = { status: "no", certainty: "probable" };
    }
  }
  return result;
}

export function chooseFeature(
  profile: VehicleProfile,
  id: string,
  state: FeatureState | null,
): VehicleProfile {
  const result = { ...profile };
  if (state) result[id] = state;
  else delete result[id];
  if (state?.status === "has") {
    for (const group of EXCLUSIVE_FEATURES) {
      if (!group.some((feature) => feature === id)) continue;
      for (const other of group)
        if (other !== id && result[other]?.status === "has")
          delete result[other];
    }
  }
  return result;
}

const probable = (status: FeatureStatus): FeatureState => ({
  status,
  certainty: "probable",
});

/**
 * Suggestions derived from the engine chosen from the official catalogue.
 * Only what the fuel type tells for sure; LPG stays open (often fitted
 * later).
 */
export function suggestFromSpec(spec: CarSpec | undefined): VehicleProfile {
  if (!spec) return {};
  const out: VehicleProfile = {};
  const set = (id: FeatureId, status: FeatureStatus) =>
    (out[id] = probable(status));
  switch (spec.fuel) {
    case "petrol":
    case "e85":
      set("engine.diesel", "no");
      set("engine.hybrid", "no");
      set("engine.plugin", "no");
      set("engine.cng", "no");
      break;
    case "diesel":
      set("engine.diesel", "has");
      set("engine.hybrid", "no");
      set("engine.plugin", "no");
      set("engine.lpg", "no");
      set("engine.cng", "no");
      break;
    case "lpg":
      set("engine.lpg", "has");
      set("engine.diesel", "no");
      set("engine.plugin", "no");
      break;
    case "cng":
      set("engine.cng", "has");
      set("engine.diesel", "no");
      set("engine.plugin", "no");
      break;
    case "hybrid-petrol":
    case "hybrid-diesel":
      set("engine.hybrid", "has");
      set("engine.plugin", "no");
      set("engine.diesel", spec.fuel === "hybrid-diesel" ? "has" : "no");
      break;
    case "plugin-petrol":
    case "plugin-diesel":
      set("engine.hybrid", "has");
      set("engine.plugin", "has");
      set("engine.diesel", spec.fuel === "plugin-diesel" ? "has" : "no");
      break;
    case "electric":
      set("engine.plugin", "has");
      set("engine.diesel", "no");
      set("engine.hybrid", "no");
      set("engine.lpg", "no");
      set("engine.cng", "no");
      break;
  }
  return out;
}
