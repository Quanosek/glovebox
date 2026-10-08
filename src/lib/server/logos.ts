import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CarFile } from "@/lib/cars";
import { catalogKey } from "@/lib/catalog";
import { getDatabaseDir } from "@/lib/content";
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
const USER_AGENT =
  "opel-cascada-manual/1.0 (https://github.com/Quanosek/opel-cascada-manual; private local app)";
const IMAGE_WIDTH = 400;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_CANDIDATES = 5;
const TIMEOUT_MS = 15_000;

const DAY = 24 * 60 * 60 * 1000;
/** Found brands are refreshed monthly; misses and errors are retried sooner. */
const TTL = { found: 30 * DAY, missing: 7 * DAY, failed: DAY / 24 };
/** Bump when the brand matching changes so cached lookups are redone. */
const CACHE_VERSION = 1;

interface BrandEntry {
  version: number;
  fetchedAt: number;
  ttl: number;
  entity: string | null;
  logos: BrandLogo[];
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

function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function getJson(params: Record<string, string>): Promise<unknown> {
  const url = `${WIKIDATA}?${new URLSearchParams({ ...params, format: "json" })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  return res.json();
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
  for (const id of logoCandidates(search.search ?? [], name).slice(
    0,
    MAX_CANDIDATES,
  )) {
    const logos = parseLogoClaims(
      await getJson({ action: "wbgetclaims", entity: id, property: "P154" }),
    );
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
async function brandLogos(name: string): Promise<BrandLogo[]> {
  const key = catalogKey(name).toLowerCase();
  if (!key) return [];
  const file = path.join(logoDir(), `brand-${key}.json`);
  return once(`brand:${key}`, async () => {
    const cached = await readJson<BrandEntry>(file);
    const valid = cached?.version === CACHE_VERSION ? cached : null;
    if (valid && Date.now() - valid.fetchedAt < valid.ttl) return valid.logos;
    let entry: BrandEntry;
    try {
      entry = {
        version: CACHE_VERSION,
        fetchedAt: Date.now(),
        ...(await lookupBrand(name)),
      };
    } catch {
      if (valid?.entity) return valid.logos;
      entry = {
        version: CACHE_VERSION,
        fetchedAt: Date.now(),
        ttl: TTL.failed,
        entity: null,
        logos: [],
      };
    }
    try {
      await fs.mkdir(logoDir(), { recursive: true });
      await fs.writeFile(file, JSON.stringify(entry));
    } catch {
      // A read-only database still serves logos for this run.
    }
    return entry.logos;
  });
}

const imageBase = (file: string) =>
  path.join(logoDir(), createHash("sha1").update(file).digest("hex"));

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
