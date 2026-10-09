/**
 * "Najczęściej potrzebne" tiles of the car page: topics owners look up most
 * often on manufacturers' owner pages. Like `featureRules.ts`, each topic is
 * found by Polish regex rules on section titles of every car's manuals; a
 * topic without a matching section is not shown. Editing rules needs no
 * re-extraction.
 */

export type QuickTopicId =
  | "tyres"
  | "wheel"
  | "fuses"
  | "bulbs"
  | "fluids"
  | "fuel"
  | "indicators"
  | "help"
  | "service";

export interface QuickTopic {
  id: QuickTopicId;
  label: string;
  pattern: RegExp;
  exclude?: RegExp;
}

export const QUICK_TOPICS: QuickTopic[] = [
  {
    id: "tyres",
    label: "Ciśnienie w oponach",
    pattern: /ciśnieni\w* (w )?(opon|ogumieni)|ciśnieni\w* powietrza/i,
  },
  {
    id: "wheel",
    label: "Wymiana koła",
    pattern:
      /(zmian|wymian)\w* koła|koł\w* (zapasow|dojazdow)|przebit\w* opon|zestaw\w* (do )?napraw\w* (ogumienia|opon)/i,
  },
  { id: "fuses", label: "Bezpieczniki", pattern: /bezpiecznik/i },
  {
    id: "bulbs",
    label: "Żarówki",
    pattern: /żarów|wymian\w* (lamp|świateł|oświetleni)/i,
    exclude: /lampk\w* kontroln/i,
  },
  {
    id: "fluids",
    label: "Olej i płyny",
    pattern:
      /olej\w* silnik|poziom\w* oleju|płyn\w* (chłodząc|hamulcow|do spryskiwacz|eksploatacyjn)|komor\w* silnika|kontrol\w* (pojazdu|samochodu)/i,
  },
  {
    id: "fuel",
    label: "Tankowanie",
    pattern: /tankowani|wlew\w* paliwa|paliw(o|a)\b/i,
    exclude: /wskaźnik|zużyci|poziom/i,
  },
  {
    id: "indicators",
    label: "Lampki kontrolne",
    pattern:
      /lampk\w* (kontroln|ostrzegawcz)|kontrolk|wskaźnik\w* i lampk|symbol\w* (ostrzegawcz|kontroln)/i,
  },
  {
    id: "help",
    label: "Pomoc drogowa",
    pattern:
      /pomoc\w* drogow|w razie (awarii|wypadku)|holowani\w* (samochodu|pojazdu|auta)|uruchamiani\w* (silnika )?(za pomocą|przy użyciu|z) (kabl|akumulator|innego)|rozruch\w* (awaryjn|z obcego)|ecall|połączeni\w* alarmow/i,
  },
  {
    id: "service",
    label: "Przeglądy",
    pattern:
      /przegląd|obsług\w* (okresow|serwisow|technicz)|harmonogram\w* (przeglądów|obsługi)|plan\w* obsługi|serwis\w* (okresow|pojazdu|samochodu)|książk\w* serwisow/i,
  },
];

/** Most tiles on the car page (the rest stay reachable through search). */
export const QUICK_TOPICS_MAX = 8;

/** Topic ids matched by one section title. */
export function matchQuickTopics(title: string): QuickTopicId[] {
  return QUICK_TOPICS.filter(
    (t) => t.pattern.test(title) && !(t.exclude && t.exclude.test(title)),
  ).map((t) => t.id);
}

/** Sections whose icons form the "Lampki kontrolne" glossary. */
export const INDICATOR_SECTION =
  /lampk\w* (kontroln|ostrzegawcz)|kontrolk|wskaźnik|symbol|zestaw\w* wskaźników|tablic\w* (przyrządów|wskaźników)/i;

/** Sections whose tables form the "Dane techniczne" cards. */
export const TECHNICAL_SECTION =
  /dane techniczne|dane (silnika|pojazdu)|specyfikacj|parametr\w* techn|pojemnoś|ciśnieni\w* (w )?(opon|ogumieni)|rozmiar\w* (opon|kół)|wymiary|\bmas[ay]\b|ładownoś|obciążeni\w* (dachu|osi|haka)|osiągi|zużyci\w* paliwa|emisj\w* co|olej\w* silnikow|płyny (eksploatacyjne|i smary)|środki smarne|momenty? dokręcani|identyfikacj/i;
