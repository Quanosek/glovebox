import type { BookId } from "@/content/types";
import type { FeatureId } from "./vehicle";

/**
 * Rules that tag manual sections with optional equipment, for every car.
 *
 * A rule matches a section when `pattern` matches its title (case-insensitive,
 * Polish diacritics kept) and `exclude` (if any) does not. Tags are inherited
 * by all sub-sections. Rules are generic Polish phrases used by owner's
 * manuals of all brands; brand names of systems are listed where they are
 * common. Editing them needs no re-extraction.
 */
export interface FeatureRule {
  feature: FeatureId;
  pattern: RegExp;
  exclude?: RegExp;
  /** Restrict the rule to one book id. */
  book?: BookId;
}

export const FEATURE_RULES: FeatureRule[] = [
  // Drive
  {
    feature: "engine.diesel",
    pattern: /diesel|wysokoprężn|filtr\w* cząstek stałych|adblue|\bdpf\b/i,
  },
  {
    feature: "engine.lpg",
    pattern: /\blpg\b|gaz\w* płynn|instalacj\w* gazow|autogaz/i,
  },
  { feature: "engine.cng", pattern: /\bcng\b|gaz\w* ziemn|metan/i },
  {
    feature: "engine.plugin",
    pattern:
      /plug-?in|kab\w* (do )?ładowania|gniazd\w* ładowania|stacj\w* ładowania|wallbox|ładowani\w* (pojazdu|samochodu|auta|akumulatora (wysokiego napięcia|trakcyjn))|zasięg\w* elektryczn/i,
  },
  { feature: "engine.hybrid", pattern: /hybryd/i },
  {
    feature: "transmission.manual",
    pattern:
      /manualn\w* skrzyni\w* biegów|skrzyni\w* manualn|ręczn\w* skrzyni/i,
  },
  {
    feature: "transmission.automatic",
    pattern:
      /automatyczn\w* skrzyni\w* biegów|skrzyni\w* automatyczn|dwusprzęgłow|skrzyni\w* (dsg|cvt|bezstopniow)/i,
  },
  {
    feature: "drive.allWheel",
    pattern:
      /napęd\w* (na )?(cztery|4|wszystkie) koła|\b4x4\b|\b(4wd|awd)\b|quattro|xdrive|4motion|4matic/i,
  },
  {
    feature: "drive.startStop",
    pattern:
      /start[ -/]?stop|stop[ -/]?start|autostop|automatyczn\w* wyłączani\w* silnika/i,
    exclude: /przycisk\w* start/i,
  },
  {
    feature: "drive.ecoDisplay",
    pattern: /\beco\b|wskaźnik\w* zmiany bieg|wskazówk\w* zmiany bieg/i,
  },
  { feature: "drive.adaptiveCruise", pattern: /adaptacyjn\w* tempomat/i },
  {
    feature: "drive.cruiseControl",
    pattern:
      /tempomat|automatyczn\w* kontrol\w* prędkości|stał\w* prędkości jazdy/i,
    exclude: /adaptacyjn/i,
  },
  {
    feature: "drive.speedLimiter",
    pattern: /ogranicznik\w* prędkości|ograniczeni\w* prędkości/i,
    exclude: /znak/i,
  },
  {
    feature: "drive.tractionControl",
    pattern: /kontroli trakcji|układ\w* \(?tc\)?|\basr\b/i,
  },
  {
    feature: "drive.esc",
    pattern: /stabilizacji toru jazdy|\besc\b|\besp\b/i,
  },
  {
    feature: "drive.electricParkingBrake",
    pattern: /elektryczn\w* hamul\w* postojow|elektromechaniczn\w* hamul/i,
  },
  {
    feature: "drive.flexRide",
    pattern:
      /flex ?ride|adaptacyjn\w* zawieszeni|interaktywn\w* układ\w* jezdn|tryb\w* jazdy|tryb\w* sport|wybór profilu jazdy/i,
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
      /asystent\w* świateł drogowych|automatyczn\w* (włączani\w* )?świateł drogowych|inteligentn\w* oświetleni|regulacj\w* wiązki świateł/i,
  },
  {
    feature: "lights.afl",
    pattern:
      /\bafl\b|adaptacyjn\w* oświetleni|ksenon|doświetlani\w* zakrętów|reflektor\w* (adaptacyjn|led|matrycow)|matrix/i,
  },
  { feature: "lights.halogen", pattern: /halogen/i },
  {
    feature: "lights.automatic",
    pattern:
      /automatyczn\w* (sterowani\w* |włączani\w* )?(świateł|reflektorów)|czujnik\w* zmierzchu/i,
    exclude: /drogowych/i,
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
      /elektroniczn\w* (układ\w* )?(sterowania )?klimatyzacj|klimatyzacj\w* sterowan\w* elektroniczn|automatyczn\w* klimatyzacj|klimatronik|dwustrefow|wielostrefow|trójstrefow/i,
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
    pattern: /(ogrzewan|podgrzewan)\w* (koł\w* )?kierownic/i,
  },
  { feature: "rearWindow.heated", pattern: /ogrzewani\w* tyln\w* szyb/i },
  {
    feature: "comfort.rainSensor",
    pattern: /czujnik\w* deszczu|automatyczn\w* wycieraczk/i,
  },
  {
    feature: "comfort.auxHeater",
    pattern:
      /ogrzewani\w* postojow|ogrzewacz\w* (postojow|powietrza)|webasto|dodatkow\w* (układ\w* )?ogrzewani/i,
  },
  {
    feature: "comfort.sunroof",
    pattern:
      /szyberdach|dach\w* (panoramiczn|przesuwn|szklan)|okn\w* dachow|roleta dach/i,
  },
  {
    feature: "comfort.windDeflector",
    pattern: /wiatrochron|osłon\w* przeciwwiatrow/i,
  },

  // Access
  {
    feature: "key.keyless",
    pattern:
      /keyless|bezkluczykow|elektroniczn\w* klucz|kluczyk\w* elektroniczn|przycisk\w* (start|uruchamiania)/i,
  },
  {
    feature: "roof.remote",
    pattern: /komfortow\w* otwierani|otwierani\w* dachu (za pomocą )?pilot/i,
  },
  {
    feature: "roof.electric",
    pattern:
      /\bdach\b|dach\w* składan|składan\w* dach|składani\w* dachu|(otwierani|zamykani)\w* dachu|miękki\w* dach|kabriolet/i,
    exclude:
      /bagażnik\w* dachow|reling|szyberdach|panoramiczn|przesuwn|okn\w* dachow|obciążeni\w* dachu|na dachu/i,
  },
  {
    feature: "access.alarm",
    pattern: /alarm/i,
    exclude:
      /połączeni\w* alarmow|numer\w* alarmow|alarmow\w* (połączeni|numer)|sos/i,
  },

  // Assist
  {
    feature: "assist.camera360",
    pattern:
      /kamer\w* 360|360°|widok\w* (z góry|z lotu ptaka|dookoła)|kamer\w* panoramiczn/i,
  },
  {
    feature: "assist.rearCamera",
    pattern: /kamer\w* (cofania|tyln|wsteczn)/i,
  },
  {
    feature: "assist.advancedParkAssist",
    pattern:
      /zaawansowan\w* (asystent|układ|system)\w* (wspomagania )?parkowania|inteligentn\w* system\w* wspomagania parkowania|pilot\w* parkowania|advanced park assist|automatyczn\w* parkowani|samodzieln\w* parkowani|park assist/i,
  },
  {
    feature: "assist.parkSensors",
    pattern:
      /czujnik\w* parkowania|asystent\w* parkowania|układ\w* ułatwiając\w* parkowani|park ?pilot|parktronic|ostrzegani\w* o przeszkodach/i,
    exclude: /zaawansowan|automatyczn|inteligentn|pilot\w* parkowania/i,
  },
  {
    feature: "assist.sideBlindSpot",
    pattern: /martw\w* pol|martwym polu/i,
  },
  {
    feature: "assist.laneDeparture",
    pattern:
      /zmian\w* pasa ruchu|opuszczeni\w* pasa|utrzymani\w* pasa|asystent\w* pasa/i,
    exclude: /sygnalizacj\w* skrętu|kierunkowskaz/i,
  },
  {
    feature: "assist.trafficSign",
    pattern: /rozpoznawani\w* znaków|znak\w* drogow|asystent\w* znak/i,
  },
  {
    feature: "assist.forwardCollision",
    pattern:
      /kolizj|odległości od poprzedzającego|hamowani\w* awaryjn|automatyczn\w* hamowani/i,
  },
  {
    feature: "assist.headUp",
    pattern:
      /head-?up|wyświetlacz\w* przezierny|wyświetlacz\w* na (przedniej )?szybie/i,
  },

  // Infotainment
  { feature: "infotainment.navigation", pattern: /nawigacj/i },
  {
    feature: "infotainment.phoneProjection",
    pattern: /carplay|android auto|projekcj\w* (ekranu )?telefon/i,
  },
  { feature: "infotainment.dab", pattern: /\bdab\b|radi\w* cyfrow/i },
  {
    feature: "infotainment.voice",
    pattern: /rozpoznawani\w* mowy|sterowani\w* głosow|polece\w* głosow/i,
  },
  {
    feature: "infotainment.premiumAudio",
    pattern:
      /infinity|\bbose\b|harman|burmester|bang ?& ?olufsen|meridian|nagłośnieni\w* premium/i,
  },
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
    pattern: /monitorowani\w* ciśnienia|kontrol\w* ciśnienia w opon/i,
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
