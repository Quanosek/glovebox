import fs from "node:fs/promises";
import path from "node:path";
import {
  brandKey,
  brandName,
  catalogKey,
  createBrandResolver,
  isTypoOf,
  engineId,
  engineLabel,
  fuelKind,
  modelFamily,
  smartCase,
  stripDiacritics,
  type CarSpec,
  type CatalogBrand,
  type CatalogEngine,
  type CatalogModel,
  type FuelKind,
} from "@/lib/catalog";
import { getDatabaseDir } from "@/lib/content";

/**
 * Official car catalogue used by the "Dodaj auto" wizard (docs/catalog.md).
 *
 * Sources (public, no API keys, queried only by this server — never by the
 * browser — and only when someone adds a car):
 *
 * - EEA "Monitoring of CO2 emissions from passenger cars" (Regulation (EU)
 *   2019/631): every new passenger car registered in the EU since 2010 with
 *   make, commercial name, fuel, engine size and power. DISCODATA SQL API.
 * - NHTSA vPIC: makes and models of every model year sold in the USA (the
 *   other main source of imported cars).
 *
 * Results are cached as JSON in `database/.catalog/` (git-ignored) and served
 * from there while fresh; when the sources cannot be reached a stale copy is
 * used. Without any copy the wizard falls back to manual entry ("Inna").
 */

const EEA_SQL = "https://discodata.eea.europa.eu/sql";
const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles";
const EEA_MAIN_TABLE = "[CO2Emission].[latest].[co2cars]";
/** First year published as a separate table (`co2cars_<year><F|P>v<n>`). */
const EEA_FIRST_YEARLY = 2023;
const VPIC_FIRST_YEAR = 2000;
const VPIC_TYPES = ["car", "multipurpose passenger vehicle (mpv)"];
/** Parallel vPIC requests; the service blocks bursts of traffic. */
const VPIC_CONCURRENCY = 3;

const DAY = 24 * 60 * 60 * 1000;
const TTL = {
  tables: 7 * DAY,
  brands: 7 * DAY,
  models: 14 * DAY,
  engines: 30 * DAY,
  partial: DAY / 24,
};

/** Bump when the normalisation changes so old cache files are rebuilt. */
const CACHE_VERSION = 3;

/** EU registrations that make a clean make name a reference brand. */
const STRONG_BRAND_REGISTRATIONS = 5000;
/** Brands with fewer EU registrations (and no US models) are dropped. */
const MIN_BRAND_REGISTRATIONS = 1000;
/**
 * Models with fewer EU registrations (and no US model years) are dropped:
 * a share of the brand's registrations, clamped to these bounds.
 */
const MIN_MODEL_REGISTRATIONS = 20;
const MAX_MIN_MODEL_REGISTRATIONS = 1000;
const MIN_MODEL_SHARE = 0.0002;
const MIN_YEAR_REGISTRATIONS = 10;
const MIN_YEAR_SHARE_OF_PEAK = 0.01;
/** A small spelling variant is merged when the bigger one is this much larger. */
const TYPO_RATIO = 10;
const POPULAR_BRANDS = 30;

/** US-only makes that are replica, kit-car, coach or bus builders. */
const NOT_CAR_MAKERS =
  /\b(CUSTOMS?|VINTAGE|CLASSICS?|REPLICAS?|REPRODUCTION|COACH|COACHWORKS|COACHBUILDERS|BUS|STAGEWAY|KIT|RACE|AUTOWORKZ|YESTER|SPRINTER|MOBILITY)\b/i;

export class CatalogUnavailableError extends Error {
  constructor() {
    super(
      "Nie udało się pobrać aktualnej listy aut. Sprawdź połączenie z internetem albo wybierz markę „Inna” i wpisz dane ręcznie.",
    );
    this.name = "CatalogUnavailableError";
  }
}

/** JSON error response for the catalogue API routes. */
export function catalogErrorResponse(err: unknown): Response {
  if (err instanceof CatalogUnavailableError)
    return Response.json({ error: err.message }, { status: 503 });
  console.error(err);
  return Response.json(
    { error: "Nie udało się wczytać listy aut." },
    { status: 500 },
  );
}

/* ------------------------------------------------------------ fetching */

const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** SQL `IN` lists of make names, split to keep request URLs short. */
function makeLists(names: string[], maxLength = 1200): string[] {
  const lists: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const name of names.map(sqlString)) {
    if (current.length > 0 && length + name.length > maxLength) {
      lists.push(current.join(","));
      current = [];
      length = 0;
    }
    current.push(name);
    length += name.length + 1;
  }
  if (current.length > 0) lists.push(current.join(","));
  return lists;
}

async function eea<T>(query: string): Promise<T[]> {
  const url = `${EEA_SQL}?${new URLSearchParams({ query, p: "1", nrOfHits: "200000" })}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`EEA HTTP ${res.status}`);
  const body = (await res.json()) as {
    results?: T[];
    errors?: { error: string; errorcode?: number }[];
  };
  if (body.errors?.length) throw new EeaQueryError(body.errors[0].error);
  return body.results ?? [];
}

class EeaQueryError extends Error {}

/** After a refusal (rate limit) vPIC is left alone for a while. */
let vpicPausedUntil = 0;

async function vpic<T>(pathname: string): Promise<T[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (Date.now() < vpicPausedUntil) throw new Error("vPIC paused");
    try {
      const res = await fetch(`${VPIC}${pathname}?format=json`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 403 || res.status === 429) {
        vpicPausedUntil = Date.now() + TTL.partial;
        throw new Error(`vPIC HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`vPIC HTTP ${res.status}`);
      return ((await res.json()) as { Results?: T[] }).Results ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

/* --------------------------------------------------------------- cache */

interface CacheFile<T> {
  version: number;
  savedAt: number;
  ttl: number;
  value: T;
}

const inflight = new Map<string, Promise<unknown>>();

const cacheDir = () => path.join(getDatabaseDir(), ".catalog");

async function cached<T>(
  name: string,
  ttl: number,
  load: () => Promise<{ value: T; partial?: boolean }>,
): Promise<T> {
  const file = path.join(cacheDir(), `${name}.json`);
  let stale: CacheFile<T> | null = null;
  try {
    stale = JSON.parse(await fs.readFile(file, "utf8")) as CacheFile<T>;
    if (stale.version !== CACHE_VERSION) stale = null;
    else if (Date.now() - stale.savedAt < stale.ttl) return stale.value;
  } catch {
    stale = null;
  }
  const running = inflight.get(name) as Promise<T> | undefined;
  if (running) return running;
  const job = (async () => {
    try {
      const { value, partial } = await load();
      const entry: CacheFile<T> = {
        version: CACHE_VERSION,
        savedAt: Date.now(),
        ttl: partial ? TTL.partial : ttl,
        value,
      };
      await fs.mkdir(cacheDir(), { recursive: true });
      await fs.writeFile(file, JSON.stringify(entry), "utf8");
      return value;
    } catch (err) {
      if (stale) return stale.value;
      console.error(`Car catalogue (${name}) unavailable:`, err);
      throw new CatalogUnavailableError();
    } finally {
      inflight.delete(name);
    }
  })();
  inflight.set(name, job);
  return job;
}

/* -------------------------------------------------------------- tables */

interface EeaTable {
  name: string;
  years: number[];
}

/**
 * The EEA publishes 2010–2022 in one table and every later year in its own
 * versioned table (`co2cars_2024Fv30`: F = final, P = provisional). The
 * newest final version of each year wins, otherwise the newest provisional.
 */
function getTables(): Promise<EeaTable[]> {
  return cached("tables", TTL.tables, async () => {
    const main = await eea<{ Year: number }>(
      `SELECT DISTINCT Year FROM ${EEA_MAIN_TABLE}`,
    );
    const mainYears = main.map((r) => r.Year).filter(Number.isInteger);
    const tables: EeaTable[] = [
      { name: EEA_MAIN_TABLE, years: mainYears.sort() },
    ];
    const current = new Date().getFullYear();
    for (let year = EEA_FIRST_YEARLY; year <= current; year++) {
      if (mainYears.includes(year)) continue;
      const name = await findYearTable(year);
      if (name) tables.push({ name, years: [year] });
    }
    return { value: tables };
  });
}

async function findYearTable(year: number): Promise<string | null> {
  const k = year - EEA_FIRST_YEARLY;
  const candidates: { status: "F" | "P"; version: number }[] = [];
  for (const [status, base] of [
    ["F", 28 + 2 * k],
    ["P", 27 + 2 * k],
  ] as const) {
    for (let d = -3; d <= 6; d++)
      candidates.push({ status, version: base + d });
  }
  const tableName = (c: (typeof candidates)[number]) =>
    `[CO2Emission].[latest].[co2cars_${year}${c.status}v${c.version}]`;
  const found = await mapLimit(candidates, 6, async (c) => {
    try {
      await eea(`SELECT TOP 1 Year FROM ${tableName(c)}`);
      return true;
    } catch (err) {
      if (err instanceof EeaQueryError) return false;
      throw err;
    }
  });
  const existing = candidates.filter((_, i) => found[i]);
  const best =
    existing
      .filter((c) => c.status === "F")
      .sort((a, b) => b.version - a.version)[0] ??
    existing
      .filter((c) => c.status === "P")
      .sort((a, b) => b.version - a.version)[0];
  return best ? tableName(best) : null;
}

/* -------------------------------------------------------------- brands */

interface BrandEntry extends CatalogBrand {
  /** Raw EEA make names (for queries). */
  raw: string[];
  registrations: number;
  vpicIds: number[];
}

function getBrandEntries(): Promise<BrandEntry[]> {
  return cached("brands", TTL.brands, async () => {
    const tables = await getTables();
    const eeaRows = (
      await Promise.all(
        tables.map((t) =>
          eea<{ Mk: string | null; n: number }>(
            `SELECT Mk, COUNT(*) n FROM ${t.name} GROUP BY Mk`,
          ),
        ),
      )
    ).flat();
    // The US list is optional: without it the EU data alone is used.
    let partial = false;
    const makes = (
      await Promise.all(
        VPIC_TYPES.map((type) =>
          vpic<{ MakeId: number; MakeName: string }>(
            `/GetMakesForVehicleType/${encodeURIComponent(type)}`,
          ).catch((err: unknown) => {
            console.warn("Car catalogue: US make list unavailable:", err);
            partial = true;
            return [];
          }),
        ),
      )
    ).flat();

    // Pass 1: reference brands — the US list plus big EU makes that are not
    // just another spelling of a bigger one ("FORD WERKE GMBH" → FORD).
    const counts = new Map<string, { n: number; raw: string }>();
    for (const row of eeaRows) {
      const key = brandKey(row.Mk);
      if (!key || !row.Mk) continue;
      const c = counts.get(key) ?? { n: 0, raw: row.Mk };
      c.n += row.n;
      counts.set(key, c);
    }
    const weight = (key: string) => counts.get(key)?.n ?? 0;
    const strong = new Set<string>();
    for (const m of makes) {
      const key = brandKey(m.MakeName);
      if (key) strong.add(key);
    }
    [...counts.entries()]
      .filter(([, c]) => c.n >= STRONG_BRAND_REGISTRATIONS)
      .sort((a, b) => b[1].n - a[1].n)
      .forEach(([key, c]) => {
        if (strong.has(key)) return;
        const mapped = createBrandResolver(strong, weight)(c.raw);
        if (mapped === key) strong.add(key);
      });
    const resolve = createBrandResolver(strong, weight);

    // Pass 2: map every spelling onto its brand.
    const byKey = new Map<
      string,
      {
        raw: Map<string, number>;
        registrations: number;
        vpic: Map<number, string>;
      }
    >();
    const entry = (key: string) => {
      let e = byKey.get(key);
      if (!e) {
        e = { raw: new Map(), registrations: 0, vpic: new Map() };
        byKey.set(key, e);
      }
      return e;
    };
    for (const row of eeaRows) {
      const key = resolve(row.Mk);
      if (!key || !row.Mk) continue;
      const e = entry(key);
      e.registrations += row.n;
      const raw = row.Mk.trim();
      e.raw.set(raw, (e.raw.get(raw) ?? 0) + row.n);
    }
    for (const m of makes) {
      const key = resolve(m.MakeName);
      if (!key) continue;
      const e = entry(key);
      // One US make id per brand: the one spelled like the brand.
      if (e.vpic.size > 0 && brandKey(m.MakeName) !== key) continue;
      if (brandKey(m.MakeName) === key) e.vpic.clear();
      e.vpic.set(m.MakeId, m.MakeName.trim());
    }

    const brands: BrandEntry[] = [];
    for (const [key, e] of byKey) {
      const usOnly = e.registrations < MIN_BRAND_REGISTRATIONS;
      if (usOnly && e.vpic.size === 0) continue;
      if (usOnly && [...e.vpic.values()].some((n) => NOT_CAR_MAKERS.test(n)))
        continue;
      const raw = [...e.raw.entries()].sort((a, b) => b[1] - a[1]);
      brands.push({
        id: key,
        name: brandName(key, [...e.vpic.values(), ...raw.map(([n]) => n)]),
        popular: false,
        usOnly,
        raw: raw.map(([n]) => n),
        registrations: e.registrations,
        vpicIds: [...e.vpic.keys()],
      });
    }
    [...brands]
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, POPULAR_BRANDS)
      .forEach((b) => (b.popular = b.registrations > 0));
    brands.sort((a, b) => a.name.localeCompare(b.name, "pl"));
    return { value: brands, partial };
  });
}

export async function getCatalogBrands(): Promise<CatalogBrand[]> {
  return (await getBrandEntries()).map(({ id, name, popular, usOnly }) => ({
    id,
    name,
    popular,
    usOnly,
  }));
}

async function getBrandEntry(id: string): Promise<BrandEntry | undefined> {
  return (await getBrandEntries()).find((b) => b.id === id);
}

/* -------------------------------------------------------------- models */

interface ModelsFile {
  models: CatalogModel[];
  /** Merged spelling variants: family key → model id. */
  aliases: Record<string, string>;
}

interface FamilyAcc {
  names: Map<string, number>;
  usNames: Map<string, number>;
  years: Map<number, number>;
  usYears: Set<number>;
  registrations: number;
  extended: Set<string>;
  canonical?: string;
}

const brandIdOk = (id: string) => /^[A-Z0-9]{1,60}$/.test(id);

/**
 * Passenger-car models of one US make with their model years: the car / MPV
 * model lists (2 requests) filter the per-year lists (one request per year,
 * which also contain motorcycles and trucks). Throws when vPIC is down.
 */
async function getUsModels(makeId: number): Promise<Map<string, number[]>> {
  const passenger = new Set<number>();
  for (const type of VPIC_TYPES) {
    const rows = await vpic<{ Model_ID: number }>(
      `/GetModelsForMakeIdYear/makeId/${makeId}/vehicletype/${encodeURIComponent(type)}`,
    );
    rows.forEach((r) => passenger.add(r.Model_ID));
  }
  const last = new Date().getFullYear() + 1;
  const years: number[] = [];
  for (let y = VPIC_FIRST_YEAR; y <= last; y++) years.push(y);
  const perYear = await mapLimit(years, VPIC_CONCURRENCY, (year) =>
    vpic<{ Model_ID: number; Model_Name: string }>(
      `/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}`,
    ),
  );
  const out = new Map<string, number[]>();
  perYear.forEach((rows, i) => {
    for (const r of rows) {
      if (!passenger.has(r.Model_ID)) continue;
      const list = out.get(r.Model_Name) ?? [];
      list.push(years[i]);
      out.set(r.Model_Name, list);
    }
  });
  return out;
}

function getModelsFile(brandId: string): Promise<ModelsFile> {
  return cached(`models-${brandId}`, TTL.models, async () => {
    const brand = await getBrandEntry(brandId);
    if (!brand) return { value: { models: [], aliases: {} } };
    const allBrands = new Set((await getBrandEntries()).map((b) => b.id));
    const families = new Map<string, FamilyAcc>();
    const acc = (key: string) => {
      let f = families.get(key);
      if (!f) {
        f = {
          names: new Map(),
          usNames: new Map(),
          years: new Map(),
          usYears: new Set(),
          registrations: 0,
          extended: new Set(),
        };
        families.set(key, f);
      }
      return f;
    };
    const words = [...brand.raw, brand.name];

    if (brand.raw.length > 0) {
      const tables = await getTables();
      const rows = (
        await Promise.all(
          tables.flatMap((t) =>
            makeLists(brand.raw).map((list) =>
              eea<{ Cn: string | null; Year: number; n: number }>(
                `SELECT Cn, Year, COUNT(*) n FROM ${t.name} WHERE Mk IN (${list}) GROUP BY Cn, Year`,
              ),
            ),
          ),
        )
      ).flat();
      for (const row of rows) {
        const fam = modelFamily(brand.id, row.Cn, words, allBrands);
        if (!fam) continue;
        const f = acc(fam.key);
        if (fam.canonical) f.canonical = fam.name;
        f.names.set(fam.name, (f.names.get(fam.name) ?? 0) + row.n);
        f.years.set(row.Year, (f.years.get(row.Year) ?? 0) + row.n);
        f.registrations += row.n;
        fam.extended.forEach((k) => f.extended.add(k));
      }
    }

    let partial = false;
    const vpicId = brand.vpicIds[0];
    if (vpicId !== undefined) {
      try {
        const us = await getUsModels(vpicId);
        for (const [name, years] of us) {
          let fam = modelFamily(brand.id, name, words, allBrands);
          if (!fam) continue;
          // US names are clean: "Crown Victoria" stays whole unless the EU
          // data knows the shorter family.
          const full = name.replace(/\s+/g, " ").trim();
          if (
            !fam.canonical &&
            !families.has(fam.key) &&
            /\s/.test(full) &&
            catalogKey(full).startsWith(fam.key)
          )
            fam = { key: catalogKey(full), name: full, extended: [] };
          const f = acc(fam.key);
          if (fam.canonical) f.canonical = fam.name;
          f.usNames.set(fam.name, (f.usNames.get(fam.name) ?? 0) + 1);
          years.forEach((y) => f.usYears.add(y));
        }
      } catch (err) {
        console.warn(
          `Car catalogue: US models of ${brand.id} unavailable:`,
          err,
        );
        partial = true;
      }
    }

    // "ASTRASPORTSTOURER" / "CROSSLANDX": spelling variants without spaces.
    const aliases: Record<string, string> = {};
    const ordered = [...families.entries()].sort(
      (a, b) => b[1].registrations - a[1].registrations,
    );
    const parentOf = new Map<string, string>();
    for (const [key, f] of ordered)
      for (const ext of f.extended)
        if (!parentOf.has(ext)) parentOf.set(ext, key);
    const absorb = (from: string, into: string) => {
      const f = families.get(from)!;
      const p = families.get(into)!;
      f.years.forEach((n, y) => p.years.set(y, (p.years.get(y) ?? 0) + n));
      f.usYears.forEach((y) => p.usYears.add(y));
      p.registrations += f.registrations;
      families.delete(from);
      aliases[from] = into;
      for (const [k, v] of Object.entries(aliases))
        if (v === from) aliases[k] = into;
    };
    for (const [key] of ordered) {
      const parent = parentOf.get(key);
      if (!parent || parent === key) continue;
      if (!families.has(parent) || !families.has(key)) continue;
      // The bigger spelling keeps its name: "ASTRA" absorbs
      // "ASTRASPORTSTOURER", "RAV4" absorbs a cut-off "RAV".
      const [from, into] =
        families.get(key)!.registrations > families.get(parent)!.registrations
          ? [parent, key]
          : [key, parent];
      absorb(from, into);
    }

    // "INSIGINIA" / "AFIRA": rare misspellings of a much bigger family.
    const bySize = [...families.entries()].sort(
      (a, b) => b[1].registrations - a[1].registrations,
    );
    for (const [key, f] of [...bySize].reverse()) {
      if (f.usYears.size > 0) continue;
      const target = bySize.find(
        ([other, o]) =>
          other !== key &&
          families.has(other) &&
          o.registrations >= f.registrations * TYPO_RATIO &&
          isTypoOf(key, other),
      );
      if (target) absorb(key, target[0]);
    }

    // "C-HR-ICON" / "C-HR1": a big family name plus a trim or a stray digit.
    for (const [key, f] of [...bySize].reverse()) {
      if (!families.has(key) || f.usYears.size > 0) continue;
      const target = bySize.find(
        ([other, o]) =>
          other !== key &&
          families.has(other) &&
          other.length >= 2 &&
          key.startsWith(other) &&
          breaksAfter(pickName(f.names) ?? key, other.length) &&
          o.registrations >= f.registrations * TYPO_RATIO,
      );
      if (target) absorb(key, target[0]);
    }

    // Rare names are conversions, trims or typos; small brands keep more.
    let total = 0;
    families.forEach((f) => (total += f.registrations));
    const minModel = Math.min(
      MAX_MIN_MODEL_REGISTRATIONS,
      Math.max(MIN_MODEL_REGISTRATIONS, total * MIN_MODEL_SHARE),
    );
    const models: CatalogModel[] = [];
    for (const [key, f] of families) {
      if (f.registrations < minModel && f.usYears.size === 0) continue;
      // US-only entries without a name ("'34" replicas) are not models.
      if (f.registrations < minModel && !/[A-Z]/.test(key)) continue;
      // Leftover stock registered years later is not a model year.
      const peak = Math.max(0, ...f.years.values());
      const minYear = Math.max(
        MIN_YEAR_REGISTRATIONS,
        peak * MIN_YEAR_SHARE_OF_PEAK,
      );
      const years = new Set(f.usYears);
      f.years.forEach((n, y) => {
        if (n >= minYear) years.add(y);
      });
      if (years.size === 0) continue;
      models.push({
        id: key,
        name: f.canonical ?? pickName(f.usNames) ?? pickName(f.names) ?? key,
        years: [...years].sort((a, b) => a - b),
      });
    }
    models.sort((a, b) =>
      a.name.localeCompare(b.name, "pl", { numeric: true }),
    );
    return { value: { models, aliases }, partial };
  });
}

/**
 * Whether a name has a word break after its first `length` letters/digits:
 * "C-HR-Icon" after 3 ("C-HR|-Icon"), "C-HR1" after 3 (letter → digit),
 * but not "SLS" after 2 or "CX30" after 3.
 */
function breaksAfter(name: string, length: number): boolean {
  let seen = 0;
  let i = 0;
  const chars = [...stripDiacritics(name)];
  while (i < chars.length && seen < length) {
    if (/[A-Za-z0-9]/.test(chars[i])) seen++;
    i++;
  }
  const next = chars[i];
  if (next === undefined) return false;
  if (!/[A-Za-z0-9]/.test(next)) return true;
  return /\d/.test(next) && /[A-Za-z]/.test(chars[i - 1]);
}

/**
 * Most used spelling, preferring mixed case ("Karoq" over "KAROQ", "i3"
 * over "I3"); all-caps or all-lowercase spellings get automatic casing.
 */
function pickName(names: Map<string, number>): string | null {
  const sorted = [...names.entries()].sort((a, b) => b[1] - a[1]);
  const styled = sorted.find(
    ([n]) => /[a-z]/.test(n) && (/[A-Z]/.test(n) || /^[a-z]{1,2}\d/.test(n)),
  );
  if (styled) return styled[0];
  return sorted[0] ? smartCase(sorted[0][0]) : null;
}

export async function getCatalogModels(
  brandId: string,
): Promise<CatalogModel[] | null> {
  if (!brandIdOk(brandId) || !(await getBrandEntry(brandId))) return null;
  return (await getModelsFile(brandId)).models;
}

/* ------------------------------------------------------------- engines */

export async function getCatalogEngines(
  brandId: string,
  modelId: string,
  year: number,
): Promise<CatalogEngine[] | null> {
  if (!brandIdOk(brandId) || !brandIdOk(modelId) || !Number.isInteger(year))
    return null;
  const brand = await getBrandEntry(brandId);
  if (!brand) return null;
  const file = await getModelsFile(brandId);
  const model = file.models.find((m) => m.id === modelId);
  if (!model || !model.years.includes(year)) return null;
  if (brand.raw.length === 0) return [];
  const table = (await getTables()).find((t) => t.years.includes(year));
  if (!table) return [];
  return cached(
    `engines-${brandId}-${modelId}-${year}`,
    TTL.engines,
    async () => {
      const allBrands = new Set((await getBrandEntries()).map((b) => b.id));
      const words = [...brand.raw, brand.name];
      const rows = (
        await Promise.all(
          makeLists(brand.raw).map((list) =>
            eea<{
              Cn: string | null;
              Ft: string | null;
              Fm: string | null;
              ec: number | null;
              ep: number | null;
              n: number;
            }>(
              `SELECT Cn, Ft, Fm, [Ec (cm3)] ec, [Ep (KW)] ep, COUNT(*) n FROM ${table.name} WHERE Mk IN (${list}) AND Year = ${year} GROUP BY Cn, Ft, Fm, [Ec (cm3)], [Ep (KW)]`,
            ),
          ),
        )
      ).flat();
      const groups = new Map<
        string,
        { fuel: FuelKind; cm3: number | null; kw: number; n: number }
      >();
      let total = 0;
      for (const row of rows) {
        const fam = modelFamily(brand.id, row.Cn, words, allBrands);
        if (!fam || (file.aliases[fam.key] ?? fam.key) !== modelId) continue;
        total += row.n;
        if (!row.ep || row.ep <= 0) continue;
        const fuel = fuelKind(row.Ft, row.Fm);
        const cm3 =
          fuel === "electric" || !row.ec
            ? null
            : Math.round(row.ec / 100) * 100;
        const kw = Math.round(row.ep);
        const id = engineId(fuel, cm3, kw);
        const g = groups.get(id) ?? { fuel, cm3, kw, n: 0 };
        g.n += row.n;
        groups.set(id, g);
      }
      const engines = [...groups.values()]
        .filter((g) => g.n >= 3 && g.n / total >= 0.01)
        .sort((a, b) => b.n - a.n)
        .slice(0, 20)
        .map((g): CatalogEngine => ({
          id: engineId(g.fuel, g.cm3, g.kw),
          fuel: g.fuel,
          engineCm3: g.cm3,
          powerKw: g.kw,
          label: engineLabel(g.fuel, g.cm3, g.kw),
          share: Math.round((g.n / total) * 1000) / 1000,
        }))
        .sort(
          (a, b) =>
            a.fuel.localeCompare(b.fuel) ||
            (a.engineCm3 ?? 0) - (b.engineCm3 ?? 0) ||
            a.powerKw - b.powerKw,
        );
      return { value: engines };
    },
  );
}

/* -------------------------------------------------------------- lookup */

export interface ResolvedCatalogCar {
  brand: string;
  model: string;
  year: number;
  catalog: { brand: string; model: string };
  spec?: CarSpec;
}

/**
 * Checks a brand / model / year (and optional engine) chosen in the wizard
 * against the catalogue and returns the official names. Returns a Polish
 * error message when the combination does not exist.
 */
export async function resolveCatalogCar(input: {
  brand: string;
  model: string;
  year: number;
  engine?: string;
}): Promise<ResolvedCatalogCar | string> {
  const brandId = catalogKey(input.brand);
  const brand = await getBrandEntry(brandId);
  if (!brand) return "Wybierz markę z listy.";
  const models = await getCatalogModels(brandId);
  const model = models?.find((m) => m.id === catalogKey(input.model));
  if (!model) return "Wybierz model z listy.";
  if (!model.years.includes(input.year))
    return "Ten model nie był produkowany w wybranym roczniku.";
  const out: ResolvedCatalogCar = {
    brand: brand.name,
    model: model.name,
    year: input.year,
    catalog: { brand: brand.id, model: model.id },
  };
  if (input.engine) {
    const engines = await getCatalogEngines(brandId, model.id, input.year);
    const engine = engines?.find((e) => e.id === input.engine);
    if (!engine) return "Wybierz wersję silnika z listy.";
    out.spec = {
      fuel: engine.fuel,
      engineCm3: engine.engineCm3,
      powerKw: engine.powerKw,
      label: engine.label,
    };
  }
  return out;
}
