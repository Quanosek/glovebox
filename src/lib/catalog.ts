/**
 * Official car catalogue: shared types and the pure normalisation helpers
 * that turn raw registration records (EU EEA CO2 monitoring, US NHTSA vPIC)
 * into clean brand / model families. Client-safe: no Node APIs.
 * The fetching and caching lives in `src/lib/server/catalog.ts`.
 */

export interface CatalogBrand {
  /** Normalised key (`A-Z0-9`), stable across sources. */
  id: string;
  name: string;
  /** Among the most registered brands in the EU (shown first). */
  popular: boolean;
  /** Known only from the US register (not sold new in the EU). */
  usOnly: boolean;
}

export interface CatalogModel {
  id: string;
  name: string;
  /** Years with registrations (EU) or model years (US), ascending. */
  years: number[];
}

/**
 * Include current and upcoming model years for models with recent EU
 * registrations, which can appear before their first registration data.
 */
export function includeUpcomingModelYears(
  years: number[],
  currentYear: number,
): number[] {
  const result = [...new Set(years)].sort((a, b) => a - b);
  const latestYear = result.at(-1);
  if (latestYear === undefined || latestYear < currentYear - 1) return result;
  for (let year = latestYear + 1; year <= currentYear + 1; year++)
    result.push(year);
  return result;
}

export type FuelKind =
  | "petrol"
  | "diesel"
  | "lpg"
  | "cng"
  | "e85"
  | "hybrid-petrol"
  | "hybrid-diesel"
  | "plugin-petrol"
  | "plugin-diesel"
  | "electric"
  | "hydrogen"
  | "other";

export interface CatalogEngine {
  /** `${fuel}-${engineCm3}-${powerKw}` */
  id: string;
  fuel: FuelKind;
  /** Rounded to 100 cm³; null for electric cars. */
  engineCm3: number | null;
  powerKw: number;
  label: string;
  /** Share of the model's registrations in that year (0–1). */
  share: number;
}

/** Engine version chosen in the browser's vehicle profile. */
export interface CarSpec {
  fuel: FuelKind;
  engineCm3: number | null;
  powerKw: number;
  label: string;
  /** Manufacturer code from the manual, when the choice identifies a unique variant. */
  code?: string;
}

export const FUEL_LABEL: Record<FuelKind, string> = {
  petrol: "benzyna",
  diesel: "diesel",
  lpg: "benzyna + LPG",
  cng: "benzyna + CNG",
  e85: "benzyna / E85",
  "hybrid-petrol": "hybryda (benzyna)",
  "hybrid-diesel": "hybryda (diesel)",
  "plugin-petrol": "hybryda plug-in (benzyna)",
  "plugin-diesel": "hybryda plug-in (diesel)",
  electric: "elektryczny",
  hydrogen: "wodór",
  other: "inne paliwo",
};

/* ------------------------------------------------------------- strings */

const EXTRA_LETTERS: Record<string, string> = {
  ł: "l",
  Ł: "L",
  ø: "o",
  Ø: "O",
  ß: "ss",
  æ: "ae",
  Æ: "AE",
};

export function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁøØßæÆ]/g, (c) => EXTRA_LETTERS[c] ?? c);
}

/** Uppercase `A-Z0-9` key used to match names across sources. */
export function catalogKey(s: string): string {
  return stripDiacritics(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Readable casing for names that arrive in upper case ("ASTRA" → "Astra",
 * "T-ROC" → "T-Roc", "CX-5" and "BMW" stay). Mixed-case input is kept.
 */
/** Short words that are not acronyms. */
const SHORT_WORDS = new Set(["CAR", "COM", "THE", "AND", "OF", "USA"]);

export function smartCase(s: string): string {
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) return s;
  return s
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          const letters = part.replace(/[^A-Za-z]/g, "");
          if (part.toUpperCase() === "USA") return "USA";
          if (
            /\d/.test(part) ||
            (letters.length <= 3 && !SHORT_WORDS.has(part.toUpperCase()))
          )
            return part.toUpperCase();
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join("-"),
    )
    .join(" ");
}

/* -------------------------------------------------------------- brands */

const BRAND_ALIASES: Record<string, string> = {
  VW: "VOLKSWAGEN",
  VOLKSWAGENVW: "VOLKSWAGEN",
  VOKSWAGENVW: "VOLKSWAGEN",
  MERCEDES: "MERCEDESBENZ",
  MERCDESBENZ: "MERCEDESBENZ",
  MERCEDESAMG: "MERCEDESBENZ",
  MERCEDESAMGGMBH: "MERCEDESBENZ",
  BMWI: "BMW",
  BMWALPINA: "ALPINA",
  TESLAMOTORS: "TESLA",
  CITOREN: "CITROEN",
  CITROENDS: "CITROEN",
  JEPP: "JEEP",
  GREATWALLMOTOR: "GREATWALL",
  LADAAUTOMOBILEGMBH: "LADA",
  MORGANMOTOR: "MORGAN",
  CATERHAMCARSLTD: "CATERHAM",
  SHENZHENBYDAUTO: "BYD",
  MAHINDRALTD: "MAHINDRA",
  NISSANEUROPESAS: "NISSAN",
  AUTOMOBILILAMBORGHINI: "LAMBORGHINI",
  HYUNDAIGENESIS: "GENESIS",
  ROVERCARS: "ROVER",
  LANDROVERSANTANA: "SANTANA",
  BAYERISCHEMOTORENWERKE: "BMW",
  DAIMLER: "MERCEDESBENZ",
  DAIMLERCHRYSLER: "MERCEDESBENZ",
  LYNK: "LYNKCO",
  RANGEROVER: "LANDROVER",
  QUATTRO: "AUDI",
  GMKOREA: "CHEVROLET",
  KGMOBILITY: "SSANGYONG",
  ROMTURING: "DACIA",
};

/** Placeholders and ambiguous group names that are not brands. */
const NOT_BRANDS = new Set([
  "",
  "OVRIGA",
  "OTHER",
  "OTHERS",
  "DIVERSE",
  "SONSTIGE",
  "AUTRES",
  "ALTRI",
  "UNKNOWN",
  "GENERALMOTORS",
  "FOCUS",
  "NA",
  "NULL",
  "NONE",
  "OTHERBRITISH",
]);

/** Nicer display names than the automatic casing. */
const BRAND_NAMES: Record<string, string> = {
  VOLKSWAGEN: "Volkswagen",
  MERCEDESBENZ: "Mercedes-Benz",
  SKODA: "Škoda",
  CITROEN: "Citroën",
  KIA: "Kia",
  MCLAREN: "McLaren",
  SSANGYONG: "SsangYong (KGM)",
  LYNKCO: "Lynk & Co",
  DS: "DS",
  MINI: "Mini",
  SEAT: "Seat",
  FIAT: "Fiat",
  LADA: "Lada",
  JEEP: "Jeep",
  SAAB: "Saab",
  TATA: "Tata",
  ALFAROMEO: "Alfa Romeo",
  ASTONMARTIN: "Aston Martin",
  LANDROVER: "Land Rover",
  ROLLSROYCE: "Rolls-Royce",
  GREATWALL: "Great Wall",
  DRMOTORCOMPANY: "DR",
};

/** Windows-1252 characters in the 0x80–0x9F range (mojibake repair). */
const CP1252: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/** Repairs UTF-8 text that was decoded as Windows-1252 ("CitroÃ«n"). */
export function fixMojibake(s: string): string {
  if (!/[ÃÅÄÅ]/.test(s)) return s;
  const bytes: number[] = [];
  for (const c of s) {
    const code = CP1252[c] ?? c.charCodeAt(0);
    if (code > 0xff) return s;
    bytes.push(code);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    return s;
  }
}

/** Legal-form and filler words in manufacturer names. */
const COMPANY_WORDS = new Set([
  "AG",
  "GMBH",
  "SA",
  "SAS",
  "SPA",
  "SRL",
  "NV",
  "BV",
  "AB",
  "AS",
  "KG",
  "LTD",
  "LIMITED",
  "INC",
  "CO",
  "LLC",
  "CORP",
  "CORPORATION",
  "COMPANY",
  "AUTOMOBILES",
  "AUTOMOBILE",
  "AUTOMOBILI",
  "AUTOMOTIVE",
  "MOTORS",
  "MOTOR",
  "CARS",
  "CAR",
  "GROUP",
]);

/** Makes listed together that still sell the same models. */
const SAME_MODELS: Record<string, string> = { VAUXHALL: "OPEL" };

const splitWords = (s: string) =>
  stripDiacritics(fixMojibake(s))
    .replace(/\(.*?\)/g, " ")
    .split(/[\s/,.()&+-]+/)
    .map((w) => catalogKey(w))
    .filter(Boolean);

const alias = (key: string) => BRAND_ALIASES[key] ?? key;

/**
 * Basic brand key of a raw make name ("VOLKSWAGEN, VW" → "VOLKSWAGEN",
 * "FORD (D)" → "FORD"). Returns null for placeholders and group names.
 */
export function brandKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const main = fixMojibake(raw)
    .replace(/\(.*?\)/g, " ")
    .split(",")[0];
  const key = alias(catalogKey(main));
  if (key.startsWith("JAGUARLANDROVER")) return null;
  if (NOT_BRANDS.has(key) || key.length < 2 || !/^[A-Z]/.test(key)) return null;
  return key;
}

/** Optimal string alignment distance (edits incl. swaps), capped at 2. */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return Math.min(d[a.length][b.length], 2);
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

/** Similar spelling: one edit apart, same digits, long enough to be safe. */
export function isTypoOf(key: string, of: string): boolean {
  return (
    key !== of &&
    key.length >= 4 &&
    of.length >= 4 &&
    digitsOf(key) === digitsOf(of) &&
    editDistance(key, of) <= 1
  );
}

/**
 * Maps messy make names onto well-known brands: "Audi AG D-85045
 * Ingolstadt" → AUDI, "Automobiles Peugeot" → PEUGEOT, "Alfa" →
 * ALFAROMEO, "?koda" → SKODA. `strong` holds the keys of established
 * brands. Names that list two different brands ("BMW,MINI") give null.
 */
export function createBrandResolver(
  strong: ReadonlySet<string>,
  weight: (key: string) => number = () => 0,
) {
  const longKeys = [...strong, ...Object.keys(BRAND_ALIASES)]
    .filter((k) => k.length >= 4)
    .sort((a, b) => b.length - a.length);
  /** The only candidate, or one that is far bigger than the others. */
  const pick = (candidates: string[]): string | null => {
    const sorted = [...candidates].sort((a, b) => weight(b) - weight(a));
    if (sorted.length === 1) return sorted[0];
    if (sorted.length > 1 && weight(sorted[0]) > weight(sorted[1]) * 10)
      return sorted[0];
    return null;
  };
  const strongList = [...strong];

  const fromParts = (parts: string[]): string | null => {
    for (let i = 0; i + 1 < parts.length; i++) {
      const pair = alias(parts[i] + parts[i + 1]);
      if (strong.has(pair)) return pair;
    }
    for (const w of parts) if (strong.has(alias(w))) return alias(w);
    return null;
  };

  return (raw: string | null | undefined): string | null => {
    const key = brandKey(raw);
    if (!key || !raw) return null;
    const groups = fixMojibake(raw)
      .split(",")
      .map((g) => fromParts(splitWords(g)))
      .filter((k): k is string => !!k)
      .map((k) => SAME_MODELS[k] ?? k);
    if (new Set(groups).size > 1) return null;
    if (strong.has(key)) return key;

    const parts = splitWords(raw.split(",")[0]);
    if (parts.some((w) => NOT_BRANDS.has(w) && w !== "")) return null;
    const known = fromParts(parts);
    if (known) return known;
    const base = alias(parts.filter((w) => !COMPANY_WORDS.has(w)).join(""));
    if (strong.has(base)) return base;
    const head = longKeys.find((k) => k !== base && base.startsWith(k));
    if (head) return alias(head);
    if (base.length >= 4) {
      const prefixed = pick(strongList.filter((s) => s.startsWith(base)));
      if (prefixed) return prefixed;
      const typo = pick(strongList.filter((s) => isTypoOf(base, s)));
      if (typo) return typo;
    }
    if (base.length < 2 || !/^[A-Z]/.test(base) || NOT_BRANDS.has(base))
      return null;
    return base;
  };
}

export function brandName(key: string, rawNames: string[]): string {
  if (BRAND_NAMES[key]) return BRAND_NAMES[key];
  const exact = rawNames.filter((n) => catalogKey(n) === key);
  const same = rawNames.filter((n) => brandKey(n) === key);
  const pool = exact.length > 0 ? exact : same.length > 0 ? same : rawNames;
  const mixed = pool.find((n) => /[a-z]/.test(n) && /[A-Z]/.test(n));
  const name = fixMojibake(mixed ?? pool[0] ?? key).split(",")[0];
  const words = name
    .replace(/\(.*?\)/g, " ")
    .trim()
    .split(/\s+/);
  while (words.length > 1 && LEGAL_FORMS.has(catalogKey(words.at(-1)!)))
    words.pop();
  return smartCase(words.join(" "));
}

/** Legal forms dropped from the end of displayed brand names. */
const LEGAL_FORMS = new Set([
  "INC",
  "LTD",
  "LLC",
  "CO",
  "CORP",
  "CORPORATION",
  "COMPANY",
  "LIMITED",
  "GMBH",
  "AG",
  "SA",
  "SPA",
  "SRL",
]);

/* -------------------------------------------------------------- models */

/** Words that only announce a new generation ("NUEVO 2008"). */
const LEADING_NOISE = new Set([
  "N",
  "NEW",
  "NUEVO",
  "NUEVA",
  "NOUVEAU",
  "NOUVELLE",
  "NUOVA",
  "NUOVO",
  "NEUE",
  "NEUER",
  "NEUES",
  "NOVA",
  "NOVO",
  "NOWY",
  "NOWA",
  "THE",
  "ALL",
]);

/** First words that need the next word to name a model ("MODEL 3"). */
const PREFIX_WORDS = new Set([
  "MODEL",
  "URBAN",
  "GR",
  "LAND",
  "RANGE",
  "ROVER",
  "GRAND",
  "SANTA",
  "GRANDE",
  "SERIE",
  "SERIES",
  "SERIA",
  "CLASSE",
  "CLASS",
  "CLASE",
  "KLASSE",
  "KLASA",
]);

const CLASS_WORDS = /^(CLASSE|CLASS|CLASE|KLASSE|KLASA|KLASS)$/;

/** Placeholders and trim / equipment names that are not models. */
const NOT_MODELS = new Set([
  "UNKNOWN",
  "NA",
  "NULL",
  "NONE",
  "NN",
  "OTHER",
  "OTHERS",
  "DIVERSE",
  "VARIOUS",
  "DIVERS",
  "SONSTIGE",
  "TITANIUM",
  "STLINE",
  "ZETEC",
  "GHIA",
  "TREND",
  "TRENDLINE",
  "COMFORTLINE",
  "HIGHLINE",
  "AMBIENTE",
  "ELEGANCE",
  "BUSINESS",
  "PREMIUM",
  "EXCLUSIVE",
  "LUXURY",
  "SPORT",
  "COMFORT",
  "EDITION",
  "LIMITED",
  "STYLE",
  "TEKNA",
  "ACENTA",
  "VISIA",
  "DIESEL",
  "PETROL",
  "HYBRID",
  "ELECTRIC",
  "CABRIO",
  "CABRIOLET",
  "KOMBI",
  "ESTATE",
  "SEDAN",
  "HATCHBACK",
  "VAN",
  "AUTO",
  "CAR",
  "PKW",
  "CNG",
  "LPG",
  "CNGTECHNIK",
  "MOTORHOME",
  "CAMPER",
  "WOHNMOBIL",
  "VARIOBUS",
  "ALLIED",
  "ABT",
  "TAKE",
  "MOVE",
  "HIGH",
]);

/** Short words after a model name that are trims, not part of it. */
const TRIM_SUFFIXES = new Set([
  "GT",
  "GTI",
  "GTD",
  "GTE",
  "RS",
  "ST",
  "R",
  "S",
  "N",
  "SE",
  "LX",
  "EX",
  "TDI",
  "TSI",
  "HDI",
  "CDI",
  "DCI",
  "EV",
  "HEV",
  "PHEV",
  "AMG",
  "4X4",
  "AWD",
  "4WD",
  "FWD",
  "VAN",
]);

/**
 * Joins short model names written with a space ("RAV 4" → "RAV4", "C HR"
 * → "C-HR", "ID. 3" → "ID.3") so they match the usual spelling.
 */
function glueShortName(tokens: string[]): string[] {
  const [first, next] = tokens;
  if (!next || isSpecToken(next)) return tokens;
  const a = catalogKey(first);
  const b = catalogKey(next);
  if (!/^[A-Z]{1,3}$/.test(a) || !b || b.length > 4 || TRIM_SUFFIXES.has(b))
    return tokens;
  const joined = /[.-]$/.test(first)
    ? first + next
    : /^\d+$/.test(b) && a.length >= 2
      ? first + next
      : `${first}-${next}`;
  return [joined, ...tokens.slice(2)];
}

/** Engine data glued to a model name ("ID.3PRO150KW"). */
const GLUED_SPEC = /(\d+(KW|PS|CV|HP|KM|CC))+$/;

/** Removes a brand name glued to the first word ("TOYOTAAURIS" → "AURIS"). */
function stripGluedBrand(token: string, brands: string[]): string {
  const key = catalogKey(token);
  for (const b of brands) {
    if (b.length < 3 || key.length <= b.length + 1 || !key.startsWith(b))
      continue;
    let seen = 0;
    let i = 0;
    while (i < token.length && seen < b.length) {
      if (catalogKey(token[i])) seen++;
      i++;
    }
    return token.slice(i).replace(/^[^A-Za-z0-9]+/, "");
  }
  return token;
}

/** Tokens that start the engine / trim part of a commercial name. */
const isSpecToken = (t: string) =>
  /^\d+[.,]\d/.test(t) || /^\d+(KW|PS|CV|KM|HP|CC)$/i.test(t);

export interface ModelFamily {
  key: string;
  name: string;
  /** Key of the family name plus the next word(s) (merges "ASTRASPORTSTOURER"). */
  extended: string[];
  /** Official family name ("Seria 3", "Klasa C") that beats raw spellings. */
  canonical?: boolean;
}

/**
 * Model family of a raw commercial name, e.g. "TOYOTA YARIS HYBRID" →
 * "Yaris", "320d xDrive" (BMW) → "Seria 3", "C 220 d" (Mercedes) →
 * "Klasa C", "GOLF / 1.6 / TDI" → "Golf".
 */
export function modelFamily(
  brand: string,
  raw: string | null | undefined,
  brandWords: string[] = [],
  otherBrands: ReadonlySet<string> = new Set(),
): ModelFamily | null {
  if (!raw) return null;
  const text = stripDiacritics(fixMojibake(raw))
    .split(/\s*[/,(]\s*/)[0]
    .replace(/\s+/g, " ")
    .trim();
  const skip = new Set([brand, ...brandWords.map(catalogKey)]);
  if (brand === "MERCEDESBENZ") skip.add("MERCEDES").add("BENZ");
  if (brand === "VOLKSWAGEN") skip.add("VW");
  skip.delete("");
  let tokens = text.split(" ").filter(Boolean);
  while (
    tokens.length > 0 &&
    (skip.has(catalogKey(tokens[0])) ||
      LEADING_NOISE.has(catalogKey(tokens[0])))
  )
    tokens = tokens.slice(1);
  if (tokens.length === 0) return null;
  tokens[0] = stripGluedBrand(tokens[0], [...skip]);
  const first = catalogKey(tokens[0]);
  if (!first || NOT_MODELS.has(first)) return null;
  // "LEXUS NX300H" filed under Toyota: not a Toyota model.
  if (otherBrands.has(first) && first !== brand) return null;

  if (brand === "BMW") return bmwFamily(tokens);
  if (brand === "MERCEDESBENZ") return mercedesFamily(tokens);
  tokens = glueShortName(tokens);

  const words = [tokens[0]];
  for (let i = 1; i < tokens.length; i++) {
    const prev = catalogKey(words[words.length - 1]);
    if (!PREFIX_WORDS.has(prev) || isSpecToken(tokens[i])) break;
    words.push(tokens[i]);
  }
  let name = words.join(" ");
  let key = catalogKey(name);
  const glued = GLUED_SPEC.exec(key);
  if (glued && glued.index > 0) {
    key = key.slice(0, glued.index);
    name = name.replace(/\d+\s*(KW|PS|CV|HP|KM|CC)$/i, "").trim();
  }
  if (!key || !/[A-Z0-9]/.test(key) || NOT_MODELS.has(key)) return null;
  // "LAND" without "CRUISER": the name was cut by engine data.
  if (words.length === 1 && PREFIX_WORDS.has(key)) return null;
  const rest = tokens.slice(words.length).filter((t) => !isSpecToken(t));
  const extended: string[] = [];
  if (rest[0]) extended.push(key + catalogKey(rest[0]));
  if (rest[1]) extended.push(key + catalogKey(rest[0]) + catalogKey(rest[1]));
  return { key, name, extended };
}

function family(name: string): ModelFamily {
  return { key: catalogKey(name), name, extended: [], canonical: true };
}

function bmwFamily(tokens: string[]): ModelFamily | null {
  const t = catalogKey(tokens[0]);
  const next = catalogKey(tokens[1] ?? "");
  if (/^(SERIE|SERIES|SERIA|SERIJA|SERIEN|REIHE)$/.test(t))
    return /^[1-8]$/.test(next) ? family(`Seria ${next}`) : null;
  if (/^[1-8]ER$/.test(t)) return family(`Seria ${t[0]}`);
  if (t === "ACTIVE" || t === "GRAN")
    return next === "TOURER" ? family("Seria 2") : null;
  let m = /^(?:M)?([1-8])\d{2}[A-Z]*$/.exec(t);
  if (m) return family(`Seria ${m[1]}`);
  // "M1 35I" is an M135i.
  m = /^M([1-8])$/.exec(t);
  if (m && /^\d{2}[A-Z]*$/.test(next)) return family(`Seria ${m[1]}`);
  // "X8 M" was the working name of the XM.
  if (/^X8M?$/.test(t)) return family("XM");
  m = /^(I?X|Z|I|M)(\d)(?!\d)/.exec(t);
  if (m) {
    const prefix = m[1] === "IX" ? "iX" : m[1] === "I" ? "i" : m[1];
    return family(`${prefix}${m[2]}`);
  }
  if (t === "IX") return family("iX");
  if (t === "XM") return family("XM");
  return null;
}

const MERCEDES_CLASSES = /^[ABCEGMRSTVX]$/;

function mercedesFamily(tokens: string[]): ModelFamily | null {
  let t = catalogKey(tokens[0]);
  let i = 0;
  if (t === "AMG") {
    if (!tokens[1]) return null;
    i = 1;
    t = catalogKey(tokens[1]);
  } else if (t.startsWith("AMG")) {
    // "AMGGLC 43"
    tokens = [tokens[0].replace(/^amg[\s-]*/i, ""), ...tokens.slice(1)];
    t = t.slice(3);
  }
  if (t === "GT") return family("AMG GT");
  if (t === "EQ") return null;
  if (/^ML\d*$/.test(t)) return family("Klasa M");
  if (CLASS_WORDS.test(t)) {
    const cls = catalogKey(tokens[i + 1] ?? "");
    return MERCEDES_CLASSES.test(cls) ? family(`Klasa ${cls}`) : null;
  }
  // "C-CLASS", "A-KLASSE"
  const hyphen = /^([A-Z]{1,3})-?(CLASS|KLASSE|CLASSE)$/i.exec(
    stripDiacritics(tokens[i])
      .toUpperCase()
      .replace(/[^A-Z-]/g, ""),
  );
  const letters = hyphen ? hyphen[1] : (/^([A-Z]+)/.exec(t)?.[1] ?? "");
  if (!letters) return null;
  if (MERCEDES_CLASSES.test(letters)) return family(`Klasa ${letters}`);
  if (letters === "ML") return family("Klasa M");
  if (letters.length <= 3) return family(letters);
  return family(smartCase(tokens[i]));
}

/* ------------------------------------------------------------- engines */

/** Fuel kind of an EEA record (`Ft` fuel type, `Fm` fuel mode). */
export function fuelKind(ft: string | null, fm: string | null): FuelKind {
  const f = (ft ?? "").toUpperCase();
  const mode = (fm ?? "").toUpperCase();
  const plugin = mode === "P";
  if (f.includes("ELECTRIC") && f.includes("DIESEL"))
    return plugin ? "plugin-diesel" : "hybrid-diesel";
  if (f.includes("ELECTRIC") && f.includes("PETROL"))
    return plugin ? "plugin-petrol" : "hybrid-petrol";
  if (f === "ELECTRIC") return "electric";
  if (f.includes("LPG")) return "lpg";
  if (f.startsWith("NG")) return "cng";
  if (f.includes("E85")) return "e85";
  if (f.includes("HYDROGEN")) return "hydrogen";
  if (f.includes("DIESEL")) return mode === "H" ? "hybrid-diesel" : "diesel";
  if (f.includes("PETROL")) return mode === "H" ? "hybrid-petrol" : "petrol";
  return "other";
}

export const kwToHp = (kw: number) => Math.round(kw * 1.35962);

export function engineLabel(
  fuel: FuelKind,
  engineCm3: number | null,
  powerKw: number,
): string {
  const size =
    engineCm3 && fuel !== "electric"
      ? `${(engineCm3 / 1000).toFixed(1).replace(".", ",")} `
      : "";
  return `${size}${FUEL_LABEL[fuel]} · ${powerKw} kW (${kwToHp(powerKw)} KM)`;
}

export function engineId(
  fuel: FuelKind,
  engineCm3: number | null,
  powerKw: number,
): string {
  return `${fuel}-${engineCm3 ?? 0}-${powerKw}`;
}
