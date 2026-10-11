import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeDatabase } from "@/lib/server/initial";
import {
  getCatalogBrands,
  getCatalogModels,
  prewarmCatalogInBackground,
} from "@/lib/server/catalog";

let root: string;

beforeEach(async () => {
  root = path.join(
    process.cwd(),
    "node_modules/.cache/glovebox-tests",
    `initial-${randomUUID()}`,
  );
  await fs.mkdir(path.dirname(root), { recursive: true });
  vi.stubEnv("MANUALS_DATABASE_DIR", root);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await fs.rm(root, { recursive: true, force: true });
});

function officialSources(opelModel = "ASTRA") {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname === "discodata.eea.europa.eu") {
      const query = url.searchParams.get("query") ?? "";
      if (query.includes("SELECT DISTINCT Year")) {
        return Response.json({
          results: Array.from(
            { length: new Date().getFullYear() - 2009 },
            (_, i) => ({ Year: 2010 + i }),
          ),
        });
      }
      if (query.includes("GROUP BY Mk")) {
        return Response.json({
          results: [
            { Mk: "OPEL", n: 100_000 },
            { Mk: "SKODA", n: 90_000 },
          ],
        });
      }
      return Response.json({
        results: [
          {
            Cn: query.includes("'OPEL'") ? opelModel : "FABIA",
            Year: 2024,
            n: 20_000,
          },
        ],
      });
    }
    if (url.hostname === "vpic.nhtsa.dot.gov") {
      if (!url.pathname.includes("GetMakesForVehicleType"))
        throw new Error("No bulk US model scans");
      return Response.json({ Results: [] });
    }
    if (url.hostname === "www.wikidata.org") {
      if (url.searchParams.get("action") === "wbsearchentities")
        return Response.json({ search: [] });
    }
    throw new Error(`Unexpected source ${url}`);
  });
}

describe("pnpm initial data preparation", () => {
  it("runs the actual Node entry point using the existing compiler", async () => {
    const source = `
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        if (url.hostname === "discodata.eea.europa.eu") {
          const query = url.searchParams.get("query");
          const results = query.includes("SELECT DISTINCT Year")
            ? Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => ({ Year: 2010 + i }))
            : query.includes("GROUP BY Mk")
              ? [{ Mk: "OPEL", n: 100000 }]
              : [{ Cn: "ASTRA", Year: 2024, n: 20000 }];
          return Response.json({ results });
        }
        if (url.hostname === "vpic.nhtsa.dot.gov") return Response.json({ Results: [] });
        if (url.hostname === "www.wikidata.org") return Response.json({ search: [] });
        throw new Error("Unexpected source");
      };
    `;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(source)}`,
        "scripts/initial.mjs",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, MANUALS_DATABASE_DIR: root },
        timeout: 30_000,
      },
    );
    expect(stdout).toContain("Katalog przygotowany");
    expect((await fs.readdir(root)).sort()).toEqual([".catalog", ".logos"]);
    expect(await fs.readdir(path.join(root, ".catalog"))).toContain(
      "models-eu-OPEL.json",
    );
  }, 35_000);

  it("creates only the configured cache layout and prewarms every European brand", async () => {
    const fetch = officialSources();
    vi.stubGlobal("fetch", fetch);
    expect(await initializeDatabase()).toEqual({ failed: [] });
    expect((await fs.readdir(root)).sort()).toEqual([".catalog", ".logos"]);
    expect((await fs.readdir(path.join(root, ".catalog"))).sort()).toEqual([
      "brands.json",
      "models-eu-OPEL.json",
      "models-eu-SKODA.json",
      "tables.json",
    ]);
    expect((await fs.readdir(path.join(root, ".logos"))).sort()).toEqual([
      "brand-opel.json",
      "brand-skoda.json",
    ]);
    const cache = JSON.parse(
      await fs.readFile(
        path.join(root, ".catalog/models-eu-OPEL.json"),
        "utf8",
      ),
    );
    expect(cache.value.models).toEqual([
      { id: "ASTRA", name: "Astra", years: [2024] },
    ]);
    expect(cache.savedAt).toBeGreaterThan(0);
    expect(cache.savedAt).toBeLessThanOrEqual(Date.now());
    fetch.mockClear();
    await initializeDatabase();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("exposes prepared European models without waiting for US enrichment", async () => {
    vi.stubGlobal("fetch", officialSources());
    await initializeDatabase();
    let complete!: (response: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(await getCatalogModels("OPEL")).toEqual([
      { id: "ASTRA", name: "Astra", years: [2024] },
    ]);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    complete(
      Response.json({ results: [{ Cn: "ASTRA", Year: 2024, n: 20_000 }] }),
    );
    await vi.waitFor(async () => {
      expect(await fs.readdir(path.join(root, ".catalog"))).toContain(
        "models-OPEL.json",
      );
    });
  });

  it("leaves a valid empty layout if no official catalogue can be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(initializeDatabase()).rejects.toThrow();
    expect((await fs.readdir(root)).sort()).toEqual([".catalog", ".logos"]);
    expect(await fs.readdir(path.join(root, ".catalog"))).toEqual([]);
    vi.restoreAllMocks();
  });

  it("corrects expired models from official sources during runtime use", async () => {
    vi.stubGlobal("fetch", officialSources());
    await initializeDatabase();
    const file = path.join(root, ".catalog/models-OPEL.json");
    const entry = JSON.parse(
      await fs.readFile(
        path.join(root, ".catalog/models-eu-OPEL.json"),
        "utf8",
      ),
    );
    entry.savedAt = Date.now() - 15 * 24 * 60 * 60 * 1000;
    await fs.writeFile(file, JSON.stringify(entry));
    vi.stubGlobal("fetch", officialSources("INSIGNIA"));
    expect((await getCatalogModels("OPEL"))?.[0].id).toBe("ASTRA");
    await vi.waitFor(async () => {
      const corrected = JSON.parse(await fs.readFile(file, "utf8"));
      expect(corrected.value.models[0].id).toBe("INSIGNIA");
      expect(corrected.savedAt).toBeGreaterThan(entry.savedAt);
    });
    expect((await getCatalogModels("OPEL"))?.[0].id).toBe("INSIGNIA");
  });

  it("prewarms expired lists in the background without delaying the brand response", async () => {
    vi.stubGlobal("fetch", officialSources());
    await initializeDatabase();
    const savedAt = Date.now() - 15 * 24 * 60 * 60 * 1000;
    for (const brand of ["OPEL", "SKODA"]) {
      const file = path.join(root, `.catalog/models-eu-${brand}.json`);
      const entry = JSON.parse(await fs.readFile(file, "utf8"));
      await fs.writeFile(file, JSON.stringify({ ...entry, savedAt }));
    }
    const pending: (() => void)[] = [];
    const official = officialSources();
    const fetch = vi.fn(async (input: string) => {
      await new Promise<void>((resolve) => pending.push(resolve));
      return official(input);
    });
    vi.stubGlobal("fetch", fetch);
    expect((await getCatalogBrands()).map((brand) => brand.id)).toEqual([
      "OPEL",
      "SKODA",
    ]);
    const preparation = prewarmCatalogInBackground();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending.forEach((resolve) => resolve());
    await preparation;
    for (const brand of ["OPEL", "SKODA"]) {
      const entry = JSON.parse(
        await fs.readFile(
          path.join(root, `.catalog/models-eu-${brand}.json`),
          "utf8",
        ),
      );
      expect(entry.savedAt).toBeGreaterThan(savedAt);
    }
    fetch.mockClear();
    await getCatalogBrands();
    await prewarmCatalogInBackground();
    expect(fetch).not.toHaveBeenCalled();
  });
});
