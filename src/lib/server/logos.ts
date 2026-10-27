import fs from "node:fs/promises";
import path from "node:path";
import { APP_NAME } from "@/lib/brand";
import type { CarFile } from "@/lib/cars";
import { catalogKey } from "@/lib/catalog";
import { getDatabaseDir } from "@/lib/content";
import { validTimestamp, writeCache } from "@/lib/server/catalogCache";
import {
  brandMetadataFile,
  logoImageBase,
  LOGO_CACHE_VERSION,
} from "@/lib/server/logoSize";
import {
  logoCandidates,
  parseLogoClaims,
  pickLogo,
  type BrandLogo,
  type SearchHit,
} from "@/lib/logos";

/**
 * Official brand logos for the header and the car page (docs/logos.md).
 *
 * Wikidata lists the logos of a brand with the years they were used; the one
 * valid in the car's model year is downloaded from Wikimedia Commons as a PNG
 * render and kept in `database/.logos/` (git-ignored). Only this server talks
 * to Wikimedia; the browser loads `/logo/<car>`.
 */

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const COMMONS_FILE = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const USER_AGENT = `${APP_NAME} (vehicle manual library)`;
const IMAGE_WIDTH = 400;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_CANDIDATES = 5;
const TIMEOUT_MS = 15_000;

/**
 * Wikidata asks anonymous clients to keep a low request rate and answers a
 * burst with HTTP 429. Requests are spaced out; a 429/503 pauses every lookup
 * (honouring `Retry-After`) and the request is retried a few times.
 * Mutable so tests can shorten the delays.
 */
export const WIKIDATA_PACING = {
  intervalMs: 250,
  retryBaseMs: 1_000,
  maxRetryWaitMs: 15_000,
  attempts: 3,
};
let nextRequestAt = 0;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextRequestAt);
  nextRequestAt = at + WIKIDATA_PACING.intervalMs;
  if (at > now) await sleep(at - now);
}

function retryDelay(res: Response, attempt: number): number {
  const header = res.headers.get("Retry-After");
  const seconds = header === null ? NaN : Number(header);
  const date = header === null ? NaN : Date.parse(header);
  const wait = Number.isFinite(seconds)
    ? seconds * 1000
    : Number.isFinite(date)
      ? date - Date.now()
      : WIKIDATA_PACING.retryBaseMs * 2 ** attempt;
  return Math.min(Math.max(wait, 0), WIKIDATA_PACING.maxRetryWaitMs);
}

const DAY = 24 * 60 * 60 * 1000;
/** Found brands are refreshed monthly; misses and errors are retried sooner. */
const TTL = { found: 30 * DAY, missing: 7 * DAY, failed: DAY / 24 };
/**
 * Bump when the brand matching or claim parsing changes.
 */
const CACHE_VERSION = LOGO_CACHE_VERSION;

interface BrandEntry {
  version: number;
  fetchedAt: number;
  ttl: number;
  entity: string | null;
  logos: BrandLogo[];
  failure?: string;
}

const IMAGE_TYPES: { ext: string; type: string; magic: number[] }[] = [
  { ext: "png", type: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "jpg", type: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { ext: "gif", type: "image/gif", magic: [0x47, 0x49, 0x46, 0x38] },
  { ext: "webp", type: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] },
];

export interface LogoImage {
  data: Uint8Array;
  type: string;
}

const logoDir = () => path.join(getDatabaseDir(), ".logos");
const inflight = new Map<string, Promise<unknown>>();
/** Failed downloads (in memory): retried after `TTL.failed`. */
const failedImages = new Map<string, number>();
const failedBrands = new Map<string, number>();
const brandFailures = new Map<string, string>();
let metadataActive = 0;
const metadataQueue: (() => void)[] = [];

function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function getJson(params: Record<string, string>): Promise<unknown> {
  if (metadataActive >= 2)
    await new Promise<void>((resolve) => metadataQueue.push(resolve));
  else metadataActive++;
  try {
    const url = `${WIKIDATA}?${new URLSearchParams({ ...params, format: "json" })}`;
    let res!: Response;
    for (let attempt = 0; attempt < WIKIDATA_PACING.attempts; attempt++) {
      await paced();
      try {
        res = await fetch(url, {
          cache: "no-store",
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        const timeout =
          error instanceof Error &&
          ["AbortError", "TimeoutError"].includes(error.name);
        throw new Error(
          timeout
            ? "Wikidata: przekroczono czas oczekiwania"
            : "Wikidata: błąd połączenia (sprawdź DNS, proxy i dostęp do www.wikidata.org)",
        );
      }
      if (res.status !== 429 && res.status !== 503) break;
      if (attempt + 1 < WIKIDATA_PACING.attempts)
        nextRequestAt = Math.max(
          nextRequestAt,
          Date.now() + retryDelay(res, attempt),
        );
    }
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new Error("Wikidata: nieprawidłowa odpowiedź");
    }
  } finally {
    const next = metadataQueue.shift();
    if (next) next();
    else metadataActive--;
  }
}

async function lookupBrand(
  name: string,
): Promise<Omit<BrandEntry, "version" | "fetchedAt">> {
  const search = (await getJson({
    action: "wbsearchentities",
    search: name,
    language: "en",
    uselang: "en",
    type: "item",
    limit: "50",
  })) as { search?: SearchHit[] };
  if (
    !search ||
    !Array.isArray(search.search) ||
    search.search.some(
      (hit) =>
        !hit ||
        typeof hit.id !== "string" ||
        !/^Q\d+$/.test(hit.id) ||
        typeof hit.label !== "string",
    )
  )
    throw new Error("Wikidata: nieprawidłowa odpowiedź wyszukiwania");
  for (const id of logoCandidates(search.search ?? [], name).slice(
    0,
    MAX_CANDIDATES,
  )) {
    const claims = await getJson({
      action: "wbgetclaims",
      entity: id,
      property: "P154",
    });
    if (
      typeof claims !== "object" ||
      claims === null ||
      !("claims" in claims) ||
      typeof claims.claims !== "object" ||
      claims.claims === null ||
      Array.isArray(claims.claims) ||
      ("P154" in claims.claims && !Array.isArray(claims.claims.P154))
    )
      throw new Error("Wikidata: nieprawidłowa odpowiedź logotypów");
    const logos = parseLogoClaims(claims);
    if (logos.length > 0) return { entity: id, logos, ttl: TTL.found };
  }
  return { entity: null, logos: [], ttl: TTL.missing };
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Logos of a brand, from the cache while fresh (stale copy if offline). */
async function brandLogos(
  name: string,
  waitForRefresh = false,
): Promise<BrandLogo[]> {
  const key = catalogKey(name).toLowerCase();
  if (!key) return [];
  const file = brandMetadataFile(logoDir(), name);
  const cached = await readJson<BrandEntry>(file);
  const valid = validBrandEntry(cached) ? cached : null;
  // A failure recorded by another process (e.g. a rate-limited `pnpm initial`)
  // does not block a logo the owner needs now; this process keeps its own
  // hourly back-off in `failedBrands`.
  const inheritedFailure =
    !waitForRefresh && !!valid?.failure && !failedBrands.has(file);
  if (valid && !inheritedFailure && Date.now() - valid.fetchedAt < valid.ttl)
    return valid.logos;
  if (Date.now() < (failedBrands.get(file) ?? 0)) return valid?.logos ?? [];
  const refresh = once(`brand:${file}`, async () => {
    let entry: BrandEntry;
    try {
      entry = {
        version: CACHE_VERSION,
        fetchedAt: Date.now(),
        ...(await lookupBrand(name)),
      };
      if (valid?.logos.length && !entry.logos.length)
        throw new Error("Wikidata: niepełne dane logotypów");
      failedBrands.delete(file);
      brandFailures.delete(file);
    } catch (error) {
      failedBrands.set(file, Date.now() + TTL.failed);
      const failure =
        error instanceof Error && error.message.startsWith("Wikidata")
          ? error.message
          : "Wikidata: nie udało się odczytać informacji o logotypach";
      brandFailures.set(file, failure);
      if (valid) return valid.logos;
      entry = {
        version: CACHE_VERSION,
        fetchedAt: Date.now(),
        ttl: TTL.failed,
        entity: null,
        logos: [],
        failure,
      };
    }
    try {
      await writeCache(file, entry);
    } catch {
      failedBrands.set(file, Date.now() + TTL.failed);
      brandFailures.set(file, "Nie udało się zapisać informacji o logotypach");
      // A read-only database still serves logos for this run.
    }
    return entry.logos;
  });
  // Stale logos are served at once; with nothing to show, wait for the lookup.
  if (valid?.logos.length && !waitForRefresh) {
    void refresh.catch(() => {});
    return valid.logos;
  }
  return refresh;
}

function validBrandEntry(value: BrandEntry | null): value is BrandEntry {
  return (
    !!value &&
    value.version === CACHE_VERSION &&
    validTimestamp(value.fetchedAt) &&
    typeof value.ttl === "number" &&
    value.ttl > 0 &&
    value.ttl <= TTL.found &&
    (value.entity === null || /^Q\d+$/.test(value.entity)) &&
    Array.isArray(value.logos) &&
    value.logos.every(
      (logo) =>
        !!logo &&
        typeof logo.file === "string" &&
        logo.file.trim().length > 0 &&
        ["normal", "preferred", "deprecated"].includes(logo.rank) &&
        (logo.start === undefined || Number.isInteger(logo.start)) &&
        (logo.end === undefined || Number.isInteger(logo.end)),
    ) &&
    (value.entity !== null || value.logos.length === 0)
  );
}

/** Metadata only: Commons images remain lazy, cached independently by file. */
export async function prewarmLogoMetadata(
  brands: { name: string }[],
  onFailure?: (reason: string) => void,
): Promise<string[]> {
  let next = 0;
  const failed: string[] = [];
  await Promise.all(
    Array.from({ length: Math.min(2, brands.length) }, async () => {
      while (next < brands.length) {
        const brand = brands[next++];
        await brandLogos(brand.name, true);
        const file = brandMetadataFile(logoDir(), brand.name);
        const entry = await readJson<BrandEntry>(file);
        if (
          Date.now() < (failedBrands.get(file) ?? 0) ||
          entry?.ttl === TTL.failed
        ) {
          failed.push(brand.name);
          onFailure?.(
            brandFailures.get(file) ??
              (typeof entry?.failure === "string" &&
              entry.failure.startsWith("Wikidata")
                ? entry.failure.slice(0, 200)
                : "Wikidata: poprzednia próba nie powiodła się; ponowienie za godzinę"),
          );
        }
      }
    }),
  );
  return failed;
}

const imageBase = (file: string) => logoImageBase(logoDir(), file);

// `turbopackIgnore` on the template paths below keeps `next build` from
// tracing the project folder (`.venv` symlinks point outside it).
async function readImage(base: string): Promise<LogoImage | null> {
  for (const t of IMAGE_TYPES) {
    try {
      const data = await fs.readFile(
        /* turbopackIgnore: true */ `${base}.${t.ext}`,
      );
      return { data: new Uint8Array(data), type: t.type };
    } catch {
      // try the next extension
    }
  }
  return null;
}

/** Downloads a raster render of a Commons file (SVGs come back as PNG). */
async function downloadImage(file: string): Promise<LogoImage | null> {
  const base = imageBase(file);
  return once(`image:${base}`, async () => {
    const cached = await readImage(base);
    if (cached) return cached;
    if (Date.now() - (failedImages.get(base) ?? 0) < TTL.failed) return null;
    failedImages.set(base, Date.now());
    try {
      const url = `${COMMONS_FILE}${encodeURIComponent(file)}?width=${IMAGE_WIDTH}`;
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const data = new Uint8Array(await res.arrayBuffer());
      if (data.length > MAX_IMAGE_BYTES) return null;
      // Never trust the extension or Content-Type: only known raster formats.
      const t = IMAGE_TYPES.find((t) => t.magic.every((b, i) => data[i] === b));
      if (!t) return null;
      failedImages.delete(base);
      try {
        await fs.mkdir(logoDir(), { recursive: true });
        await fs.writeFile(
          /* turbopackIgnore: true */ `${base}.${t.ext}`,
          data,
        );
      } catch {
        // Serve without caching.
      }
      return { data, type: t.type };
    } catch {
      return null;
    }
  });
}

/** The brand logo of the car's model year, or null when none is known. */
export async function getCarLogo(car: CarFile): Promise<LogoImage | null> {
  const logo = pickLogo(await brandLogos(car.brand), car.year);
  return logo ? downloadImage(logo.file) : null;
}
