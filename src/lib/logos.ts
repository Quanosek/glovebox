import { catalogKey } from "@/lib/catalog";

/**
 * Brand logos from Wikidata (property P154 "logo image"), see docs/logos.md.
 * Pure helpers shared by the server module and the tests.
 */

export type LogoRank = "preferred" | "normal" | "deprecated";

export interface BrandLogo {
  /** Wikimedia Commons file name, e.g. "Opel logo.svg". */
  file: string;
  /** First / last year of use (Wikidata qualifiers P580 / P582). */
  start?: number;
  end?: number;
  rank: LogoRank;
}

export interface SearchHit {
  id: string;
  label?: string;
  description?: string;
  match?: { text?: string };
}

const yearOf = (time: unknown): number | undefined => {
  const m = typeof time === "string" ? /^([+-]\d{1,6})-/.exec(time) : null;
  return m ? Number(m[1]) : undefined;
};

/** P154 claims of a `wbgetclaims` answer. */
export function parseLogoClaims(json: unknown): BrandLogo[] {
  const claims = (json as { claims?: { P154?: unknown[] } })?.claims?.P154;
  if (!Array.isArray(claims)) return [];
  const out: BrandLogo[] = [];
  for (const raw of claims) {
    const c = raw as {
      rank?: string;
      mainsnak?: { datavalue?: { value?: unknown } };
      qualifiers?: Record<
        string,
        { datavalue?: { value?: { time?: string } } }[]
      >;
    };
    const file = c.mainsnak?.datavalue?.value;
    if (typeof file !== "string" || !file.trim()) continue;
    const rank: LogoRank =
      c.rank === "preferred" || c.rank === "deprecated" ? c.rank : "normal";
    const q = (p: string) =>
      yearOf(c.qualifiers?.[p]?.[0]?.datavalue?.value?.time);
    out.push({ file: file.trim(), start: q("P580"), end: q("P582"), rank });
  }
  return out;
}

const RANK_ORDER: Record<LogoRank, number> = {
  preferred: 2,
  normal: 1,
  deprecated: 0,
};

/** JPEGs on Wikidata are often photos of a badge or even of a car. */
const isPhoto = (l: BrandLogo) => (/\.jpe?g$/i.test(l.file) ? 1 : 0);

/**
 * The logo used in the given model year: among logos whose period covers the
 * year, the one introduced most recently (a model year in which the logo
 * changed gets the new one); undated logos cover every year. Without a
 * covering logo the brand's current (preferred) logo is used.
 *
 * Dated claims count whatever their rank — some brands mark former logos as
 * "deprecated" — while undated deprecated ones are ignored. Between logos of
 * the same period drawings (SVG / PNG) beat JPEG photos, then the rank
 * decides.
 */
export function pickLogo(
  logos: BrandLogo[],
  year: number,
): BrandLogo | undefined {
  const usable = logos.filter(
    (l) =>
      l.rank !== "deprecated" || l.start !== undefined || l.end !== undefined,
  );
  const byQuality = (a: BrandLogo, b: BrandLogo) =>
    isPhoto(a) - isPhoto(b) || RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
  const byRecency = (a: BrandLogo, b: BrandLogo) =>
    (b.start ?? -Infinity) - (a.start ?? -Infinity) || byQuality(a, b);
  const covering = usable
    .filter(
      (l) => (l.start ?? -Infinity) <= year && year <= (l.end ?? Infinity),
    )
    .sort(byRecency);
  if (covering[0]) return covering[0];
  const current = usable
    .filter((l) => l.end === undefined && l.rank !== "deprecated")
    .sort((a, b) => byQuality(a, b) || byRecency(a, b));
  return current[0] ?? [...usable].sort(byRecency)[0];
}

const CAR_COMPANY =
  /\b(cars?|automobiles?|automotive|automaker|vehicles?|motors?|marque|trucks?)\b/i;
const NOT_A_BRAND =
  /\b(model|series|concept|team|museum|club|dealer(ship)?|race|racing|engine|platform)\b/i;
const FORMER = /\b(former|defunct)\b/i;

/**
 * Wikidata search hits that may be the car brand `name`, best first: car
 * companies whose label starts with the name (or whose alias equals it),
 * current companies before former ones.
 */
export function logoCandidates(hits: SearchHit[], name: string): string[] {
  const key = catalogKey(name);
  if (!key) return [];
  const ok = hits.filter((h) => {
    const desc = h.description ?? "";
    if (!CAR_COMPANY.test(desc) || NOT_A_BRAND.test(desc)) return false;
    return (
      catalogKey(h.label ?? "").startsWith(key) ||
      catalogKey(h.match?.text ?? "") === key
    );
  });
  const former = (h: SearchHit) => (FORMER.test(h.description ?? "") ? 1 : 0);
  return [...ok].sort((a, b) => former(a) - former(b)).map((h) => h.id);
}
