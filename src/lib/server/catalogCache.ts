import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const RETRY_MS = 60 * 60 * 1000;
const inflight = new Map<string, Promise<unknown>>();
const retryAfter = new Map<string, number>();

interface CacheFile<T> {
  version: number;
  savedAt: number;
  ttl: number;
  value: T;
}

export async function writeCache(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const staging = `${file}.${randomUUID()}.pending`;
  try {
    await fs.writeFile(staging, JSON.stringify(value), "utf8");
    await fs.rename(staging, file);
  } finally {
    await fs.rm(staging, { force: true });
  }
}

export function validTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= Date.now()
  );
}

/** Serve last-good data immediately, refreshing expired entries at most hourly. */
export async function catalogCache<T>(options: {
  file: string;
  fallbackFile?: string;
  version: number;
  ttl: number;
  partialTtl: number;
  validate: (value: unknown) => value is T;
  canReplace?: (value: T, previous: T) => boolean;
  waitForRefresh?: boolean;
  load: () => Promise<{ value: T; partial?: boolean }>;
}): Promise<T> {
  const { file, version, ttl, validate } = options;
  const read = async (name: string): Promise<CacheFile<T> | null> => {
    try {
      const entry = JSON.parse(await fs.readFile(name, "utf8"));
      return entry?.version === version &&
        validTimestamp(entry.savedAt) &&
        typeof entry.ttl === "number" &&
        entry.ttl > 0 &&
        entry.ttl <= ttl &&
        validate(entry.value)
        ? (entry as CacheFile<T>)
        : null;
    } catch {
      return null;
    }
  };
  const primary = await read(file);
  const stale =
    primary ?? (options.fallbackFile ? await read(options.fallbackFile) : null);
  if (primary && Date.now() - primary.savedAt < primary.ttl)
    return primary.value;
  if (stale && Date.now() < (retryAfter.get(file) ?? 0)) return stale.value;

  let job = inflight.get(file) as Promise<T> | undefined;
  if (!job) {
    job = (async () => {
      try {
        const result = await options.load();
        if (!validate(result.value)) throw new Error("Invalid catalogue data");
        // An incomplete source response cannot erase a last-good snapshot.
        if (
          stale &&
          (result.partial ||
            options.canReplace?.(result.value, stale.value) === false)
        ) {
          retryAfter.set(file, Date.now() + options.partialTtl);
          return stale.value;
        }
        const entry: CacheFile<T> = {
          version,
          savedAt: Date.now(),
          ttl: result.partial ? options.partialTtl : ttl,
          value: result.value,
        };
        await writeCache(file, entry);
        retryAfter.delete(file);
        return result.value;
      } catch (error) {
        retryAfter.set(file, Date.now() + RETRY_MS);
        if (stale) return stale.value;
        throw error;
      } finally {
        inflight.delete(file);
      }
    })();
    inflight.set(file, job);
  }
  if (stale && !options.waitForRefresh) {
    void job.catch(() => {});
    return stale.value;
  }
  return job;
}
