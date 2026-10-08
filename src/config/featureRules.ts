import type { BookId } from "@/content/types";
import type { FeatureId } from "./vehicle";

/**
 * Rules that tag manual sections with vehicle features.
 *
 * A rule matches a section when `pattern` matches its title (case-insensitive,
 * Polish diacritics kept) and `exclude` (if any) does not. Tags are inherited
 * by all sub-sections. Edit these rules after regenerating content if a
 * section is tagged wrongly — no re-extraction is needed.
 */
export interface FeatureRule {
  feature: FeatureId;
  pattern: RegExp;
  exclude?: RegExp;
  /** Restrict the rule to one book. */
  book?: BookId;
}

export const FEATURE_RULES: FeatureRule[] = [
  // Drive
  {
    feature: "engine.diesel",
    pattern: /diesel|wysokoprężn|filtr cząstek stałych|adblue/i,
  },
  { feature: "engine.lpg", pattern: /\blpg\b|gaz płynny|instalacj\w* gazow/i },
  {
    feature: "transmission.manual",
    pattern: /manualn\w* skrzyni\w* biegów|skrzyni\w* manualn/i,
  },
  {
    feature: "transmission.automatic",
    pattern: /automatyczn\w* skrzyni\w* biegów/i,
  },
  {
    feature: "drive.startStop",
    pattern: /start[ -/]?stop|autostop|automatyczne wyłączanie silnika/i,
    exclude: /przycisk\w* start/i,
  },
  {
    feature: "drive.ecoDisplay",
    pattern: /\beco\b|wskaźnik\w* zmiany bieg|wskazówk\w* zmiany bieg/i,
  },
  { feature: "drive.adaptiveCruise", pattern: /adaptacyjn\w* tempomat/i },
  {
    feature: "drive.cruiseControl",
    pattern: /tempomat/i,
    exclude: /adaptacyjn/i,
  },
  { feature: "drive.speedLimiter", pattern: /ogranicznik\w* prędkości/i },
  {
    feature: "drive.tractionControl",
    pattern: /kontroli trakcji|układ\w* \(?tc\)?/i,
  },
  { feature: "drive.esc", pattern: /stabilizacji toru jazdy|\besc\b/i },
  {
    feature: "drive.electricParkingBrake",
    pattern: /elektryczn\w* hamul\w* postojow/i,
  },
  {
    feature: "drive.flexRide",
    pattern: /flexride|tryb\w* jazdy|tryb\w* sport/i,
  },
  {
    feature: "drive.towbar",
    pattern:
      /hak\w* holownicz|holowanie przyczep|zaczep\w* holownicz|przyczep/i,
  },

  // Lights
  {
    feature: "lights.highBeamAssist",
    pattern:
      /asystent\w* świateł drogowych|automatyczn\w* świateł drogowych|inteligentn\w* oświetleni/i,
  },
  {
    feature: "lights.afl",
    pattern:
      /\bafl\b|adaptacyjn\w* oświetleni|ksenon|doświetlani\w* zakrętów|reflektor\w* adaptacyjn/i,
  },
  { feature: "lights.halogen", pattern: /halogen/i },
  {
    feature: "lights.automatic",
    pattern: /automatyczn\w* sterowani\w* świateł|czujnik\w* zmierzchu/i,
  },

  // Comfort
  {
    feature: "climate.manual",
    pattern:
      /układ\w* ogrzewania i wentylacji|klimatyzacj\w* manualn|manualn\w* klimatyzacj/i,
  },
  {
    feature: "climate.electronic",
    pattern:
      /elektroniczn\w* (układ\w* )?klimatyzacj|automatyczn\w* klimatyzacj|dwustrefow/i,
  },
  {
    feature: "seats.ventilated",
    pattern: /wentylacj\w* fotel|wentylowan\w* fotel/i,
  },
  {
    feature: "seats.heated",
    pattern: /ogrzewani\w* fotel|podgrzewan\w* fotel/i,
  },
  {
    feature: "steeringWheel.heated",
    pattern: /ogrzewani\w* kierownic|podgrzewan\w* kierownic/i,
  },
  { feature: "rearWindow.heated", pattern: /ogrzewani\w* tyln\w* szyb/i },
  {
    feature: "comfort.rainSensor",
    pattern: /czujnik\w* deszczu|automatyczn\w* wycieraczk/i,
  },
  {
    feature: "comfort.windDeflector",
    pattern: /wiatrochron|osłon\w* przeciwwiatrow/i,
  },

  // Access
  {
    feature: "key.keyless",
    pattern: /keyless|system\w* otwierania bezkluczykow|elektroniczn\w* klucz/i,
  },
  {
    feature: "roof.remote",
    pattern: /komfortow\w* otwierani|otwierani\w* dachu (za pomocą )?pilot/i,
  },
  {
    feature: "roof.electric",
    pattern: /dach\b|dach składan|składani\w* dachu/i,
  },
  { feature: "access.alarm", pattern: /alarm/i },

  // Assist
  { feature: "assist.rearCamera", pattern: /kamer\w* cofania|kamer\w* tyln/i },
  {
    feature: "assist.advancedParkAssist",
    pattern: /zaawansowan\w* asystent\w* parkowania|advanced park assist/i,
  },
  {
    feature: "assist.parkSensorsRear",
    pattern: /czujnik\w* parkowania|asystent\w* parkowania/i,
    exclude: /zaawansowan/i,
  },
  { feature: "assist.sideBlindSpot", pattern: /martw\w* pol|martwym polu/i },
  {
    feature: "assist.laneDeparture",
    pattern: /zmian\w* pasa ruchu|utrzymani\w* pasa/i,
  },
  {
    feature: "assist.trafficSign",
    pattern: /rozpoznawani\w* znaków|znak\w* drogow|opel eye|kamer\w* przedni/i,
  },
  {
    feature: "assist.forwardCollision",
    pattern: /kolizj|odległości od poprzedzającego/i,
  },

  // Infotainment
  {
    feature: "infotainment.otherVariants",
    pattern:
      /\b(r ?4\.0|navi ?4\.0|cd ?[3-6]00|navi ?650|r ?300|dvd ?800|r ?400|intellilink r)\b/i,
    exclude: /navi ?950/i,
  },
  { feature: "infotainment.infinity", pattern: /infinity/i },
  { feature: "infotainment.onstar", pattern: /onstar/i },

  // Wheels
  {
    feature: "wheels.spare",
    pattern: /koł\w* zapasow|koł\w* dojazdow|zmian\w* koła/i,
  },
  {
    feature: "wheels.repairKit",
    pattern: /zestaw\w* (do )?napraw\w* (ogumienia|opon)|uszczelniacz/i,
  },
  {
    feature: "wheels.tpms",
    pattern: /monitorowani\w* ciśnienia|kontroli ciśnienia w opon/i,
  },
];

/** Feature ids matched by a single section title. */
export function matchFeatures(book: BookId, title: string): FeatureId[] {
  const out: FeatureId[] = [];
  for (const rule of FEATURE_RULES) {
    if (rule.book && rule.book !== book) continue;
    if (!rule.pattern.test(title)) continue;
    if (rule.exclude && rule.exclude.test(title)) continue;
    if (!out.includes(rule.feature)) out.push(rule.feature);
  }
  return out;
}
