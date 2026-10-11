/**
 * "Niezbędnik" tiles of the car page: what owners look up most often, each
 * linked to the exact place in the car's manuals (a section or a heading
 * inside it). Like `featureRules.ts`, topics are found by Polish regex rules
 * on titles of every car's manuals; a topic without a match is not shown.
 * Editing rules needs no re-extraction.
 */

export type EssentialId =
  | "indicators"
  | "tyres"
  | "wheel"
  | "fuses"
  | "bulbs"
  | "fluids"
  | "fuel"
  | "help"
  | "battery"
  | "service"
  | "key"
  | "wipers"
  | "techData";

export interface Essential {
  id: EssentialId;
  /** Polish tile title. */
  label: string;
  /** Polish one-line description of what the linked fragment explains. */
  description: string;
  /** Section or heading titles, best first: a later one is used only without a match. */
  patterns: RegExp[];
  exclude?: RegExp;
  /** Titles of enclosing sections that rule a match out (another system's upkeep). */
  avoid?: RegExp;
  /** Titles of the enclosing sections that make a match the better one. */
  context?: RegExp;
}

/** In order of importance: the first ones found fill the tiles. */
export const ESSENTIALS: Essential[] = [
  {
    id: "indicators",
    label: "Lampki kontrolne",
    description: "Co oznaczają lampki i komunikaty.",
    patterns: [
      /lampk\w* (kontroln|ostrzegawcz)|kontrolk|symbol\w* (ostrzegawcz|kontroln)/i,
    ],
    context: /wskaźnik|kontrolk|zegar|tablic\w* (przyrządów|wskaźników)/i,
  },
  {
    id: "tyres",
    label: "Ciśnienie w oponach",
    description: "Zalecane wartości i sprawdzanie ciśnienia.",
    patterns: [/ciśnieni\w* (w )?(opon|ogumieni)|ciśnieni\w* powietrza/i],
    exclude: /monitorowani|układ|system|czujnik|lampk/i,
    context: /koł|opon|ogumieni/i,
  },
  {
    id: "wheel",
    label: "Wymiana koła",
    description: "Zmiana koła lub naprawa przebitej opony.",
    patterns: [
      /(zmian|wymian)\w* koła/i,
      /koł\w* (zapasow|dojazdow)|zestaw\w* (do )?napraw\w* (ogumienia|opon)|przebit\w* opon/i,
    ],
    exclude: /\bpo (zmianie|wymianie)|czynności/i,
    context: /koł|opon|awari|poradnik|narzędzi|pomoc/i,
  },
  {
    id: "fuses",
    label: "Bezpieczniki",
    description: "Gdzie są skrzynki i jak wymienić bezpiecznik.",
    patterns: [/^(wymiana )?bezpiecznik(i|ów)?$/i, /bezpiecznik/i],
    context: /bezpiecznik|elektryczn/i,
  },
  {
    id: "bulbs",
    label: "Żarówki",
    description: "Wymiana żarówek w reflektorach i lampach.",
    patterns: [/wymian\w* żarów/i, /żarów|wymian\w* (lamp|świateł)/i],
    exclude: /lampk\w* kontroln|kontrol\w* żarów/i,
  },
  {
    id: "fluids",
    label: "Olej i płyny",
    description: "Kontrola i uzupełnianie oleju oraz płynów.",
    patterns: [
      /kontrol\w* i uzupełniani\w* płynów|płyn\w* eksploatacyjn|czynności kontroln/i,
      /olej\w* silnik|poziom\w* oleju/i,
      /płyn\w* (chłodząc|hamulcow|do spryskiwacz)/i,
    ],
    exclude:
      /wskaźnik|lampk|ciśnieni\w* oleju|temperatur|bezpiecznik|lepkoś|specyfikacj/i,
    context: /kontrol|płyn|czynności|obsług|komor\w* silnika/i,
  },
  {
    id: "fuel",
    label: "Tankowanie",
    description: "Właściwe paliwo i tankowanie.",
    patterns: [
      /^tankowanie$|uzupełniani\w* paliwa|tankowani\w* (paliwa|pojazdu|samochodu)/i,
      /tankowani|wlew\w* paliwa/i,
      /^paliwo$/i,
    ],
    exclude: /gaz|\bcng\b|\blpg\b|adblue|wskaźnik|zużyci|odcinani/i,
    context: /paliw|tankow|płyn/i,
  },
  {
    id: "help",
    label: "Pomoc drogowa",
    description: "Postępowanie w razie awarii i holowanie.",
    patterns: [
      /pomoc\w* drogow|w razie (awarii|wypadku)|sytuacj\w* awaryjn|awari\w* (pojazdu|samochodu)/i,
      /holowani\w* (samochodu|pojazdu|auta)|konieczność holowania/i,
      /ecall|połączeni\w* alarmow/i,
    ],
    exclude: /wyposażeni/i,
    context: /awar[iy]|pomoc|poradnik|holowani/i,
  },
  {
    id: "battery",
    label: "Akumulator",
    description: "Rozładowany akumulator i rozruch z kabli.",
    patterns: [
      /(uruchamiani|rozruch)\w*.*(kabl|obcego|innego)|rozładowan\w* akumulator|pomoc\w* przy rozruchu/i,
      /^akumulator\b/i,
    ],
    exclude: /wysokiego napięcia|trakcyjn|lampk|wskaźnik/i,
    context: /akumulator|rozruch|awari|poradnik|elektryczn/i,
  },
  {
    id: "service",
    label: "Przeglądy",
    description: "Przeglądy okresowe i obsługa w serwisie.",
    patterns: [
      /serwisowani\w* (samochodu|pojazdu)|harmonogram\w* przeglądów|częstotliwoś\w* przeglądów|przegląd\w* (okresow|serwisow)|książk\w* serwisow|program\w* serwisow/i,
      /obsług\w* (okresow|serwisow)/i,
      /okres\w* między przeglądami|wskaźnik\w* (przeglądu|serwisow)|termin\w* przeglądu/i,
    ],
    exclude: /mocowani|fotelik/i,
    avoid: /klimatyzac|ogrzewani|wentylac|dzieci/i,
    context: /serwis|obsług|przegląd/i,
  },
  {
    id: "key",
    label: "Kluczyk",
    description: "Wymiana baterii i awaryjne otwieranie.",
    patterns: [
      /(wymian|zmian)\w* (baterii|bateryjki)|bateri\w* (w )?(kluczyk|pilot|nadajnik)/i,
      /kluczyk|pilot\w* zdalnego/i,
    ],
    exclude: /stacyjk|zapłon|lampk/i,
    context: /kluczyk|zamk|otwierani/i,
  },
  {
    id: "wipers",
    label: "Wycieraczki",
    description: "Wymiana piór i spryskiwacze szyb.",
    patterns: [/pió\w* wycieraczek|(wymian|zmian)\w* pió/i, /wycieraczk/i],
    exclude: /czujnik|automatyczn|bezpiecznik|lampk/i,
    context: /wycieraczk|widocznoś|szyb/i,
  },
  {
    id: "techData",
    label: "Dane techniczne",
    description: "Pojemności, wymiary i masy auta.",
    patterns: [/^dane techniczne$/i, /dane (techniczne|pojazdu)/i],
    exclude: /silnika/i,
  },
];

/** Tiles fill whole rows: 4, 6 or 8 depending on the screen (`EssentialTiles`). */
export const ESSENTIALS_SIZES = [8, 6, 4] as const;

/** Tile count for the topics found: the largest size they fill, at least 4. */
export function essentialsSize(found: number): number {
  return (
    ESSENTIALS_SIZES.find((size) => found >= size) ??
    ESSENTIALS_SIZES[ESSENTIALS_SIZES.length - 1]
  );
}

/** A section or heading of a manual that may open a tile. */
export interface EssentialCandidate {
  title: string;
  /** Titles of the enclosing sections (and of the section itself), joined. */
  chain: string;
  /** A whole section rather than a heading inside one. */
  section: boolean;
}

/**
 * The fragment a tile opens: the first pattern with any match decides; among
 * its matches one inside a fitting section (`context`) wins, then a whole
 * section over a heading, then the earliest in reading order.
 */
export function pickEssential<T extends EssentialCandidate>(
  topic: Essential,
  candidates: readonly T[],
): T | undefined {
  const score = (c: T) =>
    (topic.context?.test(c.chain) ? 2 : 0) + (c.section ? 1 : 0);
  for (const pattern of topic.patterns) {
    const hits = candidates.filter(
      (c) =>
        pattern.test(c.title) &&
        !topic.exclude?.test(c.title) &&
        !topic.avoid?.test(c.chain),
    );
    if (hits.length > 0)
      return hits.reduce((best, c) => (score(c) > score(best) ? c : best));
  }
  return undefined;
}

/** Sections whose tables form the "Dane techniczne" cards. */
export const TECHNICAL_SECTION =
  /dane techniczne|dane (silnika|pojazdu)|specyfikacj|parametr\w* techn|pojemnoś|ciśnieni\w* (w )?(opon|ogumieni)|rozmiar\w* (opon|kół)|wymiary|\bmas[ay]\b|ładownoś|obciążeni\w* (dachu|osi|haka)|osiągi|zużyci\w* paliwa|emisj\w* co|olej\w* silnikow|płyny (eksploatacyjne|i smary)|środki smarne|momenty? dokręcani|identyfikacj/i;
