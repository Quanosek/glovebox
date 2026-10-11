import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogCache, writeCache } from "@/lib/server/catalogCache";

let root: string;
const validate = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((v) => typeof v === "string");
const options = () => ({
  file: path.join(root, "brands.json"),
  version: 1,
  ttl: 1000,
  partialTtl: 100,
  validate,
});
const entry = (savedAt = Date.now() - 2000, value: unknown = ["old"]) => ({
  version: 1,
  savedAt,
  ttl: 1000,
  value,
});

beforeEach(async () => {
  root = path.join(process.cwd(), `.catalog-cache-test-${randomUUID()}`);
  await fs.mkdir(root);
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("catalogue snapshots", () => {
  it("uses fresh data without network requests", async () => {
    await writeCache(options().file, entry(Date.now()));
    const load = vi.fn();
    expect(await catalogCache({ ...options(), load })).toEqual(["old"]);
    expect(load).not.toHaveBeenCalled();
  });

  it("serves expired data immediately and shares one correction", async () => {
    await writeCache(options().file, entry());
    let complete!: (value: { value: string[] }) => void;
    const load = vi.fn(
      () =>
        new Promise<{ value: string[] }>((resolve) => {
          complete = resolve;
        }),
    );
    expect(await catalogCache({ ...options(), load })).toEqual(["old"]);
    expect(await catalogCache({ ...options(), load })).toEqual(["old"]);
    expect(load).toHaveBeenCalledTimes(1);
    complete({ value: ["corrected"] });
    expect(
      await catalogCache({ ...options(), load, waitForRefresh: true }),
    ).toEqual(["corrected"]);
    expect(JSON.parse(await fs.readFile(options().file, "utf8")).value).toEqual(
      ["corrected"],
    );
    expect(await fs.readdir(root)).toEqual(["brands.json"]);
  });

  it.each([{ value: [] }, { value: ["incomplete"], partial: true }])(
    "does not overwrite last-good data with $value",
    async (result) => {
      const original = entry();
      await writeCache(options().file, original);
      const load = vi.fn(async () => result);
      expect(
        await catalogCache({ ...options(), load, waitForRefresh: true }),
      ).toEqual(["old"]);
      expect(JSON.parse(await fs.readFile(options().file, "utf8"))).toEqual(
        original,
      );
      await catalogCache({ ...options(), load });
      expect(load).toHaveBeenCalledTimes(1);
    },
  );

  it("retains an offline last-good copy without renewing its timestamp", async () => {
    const original = entry();
    await writeCache(options().file, original);
    const load = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(
      await catalogCache({ ...options(), load, waitForRefresh: true }),
    ).toEqual(["old"]);
    expect(JSON.parse(await fs.readFile(options().file, "utf8"))).toEqual(
      original,
    );
  });

  it.each([
    entry(Date.now() + 60_000),
    { ...entry(), ttl: -1 },
    { ...entry(), value: "broken" },
    { ...entry(), version: 0 },
  ])("rejects invalid cache envelopes", async (bad) => {
    await writeCache(options().file, bad);
    const load = vi.fn(async () => ({ value: ["valid"] }));
    expect(await catalogCache({ ...options(), load })).toEqual(["valid"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves prewarmed European data while US enrichment is pending", async () => {
    const fallbackFile = path.join(root, "europe.json");
    await writeCache(fallbackFile, entry(Date.now(), ["European models"]));
    let complete!: (value: { value: string[] }) => void;
    const load = vi.fn(
      () =>
        new Promise<{ value: string[] }>((resolve) => {
          complete = resolve;
        }),
    );
    expect(await catalogCache({ ...options(), fallbackFile, load })).toEqual([
      "European models",
    ]);
    complete({ value: ["European and US models"] });
    expect(
      await catalogCache({
        ...options(),
        fallbackFile,
        load,
        waitForRefresh: true,
      }),
    ).toEqual(["European and US models"]);
  });
});
