import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCarLogo, prewarmLogoMetadata } from "@/lib/server/logos";
import type { CarFile } from "@/lib/cars";

const DAY = 24 * 60 * 60 * 1000;
let root: string;
const car: CarFile = {
  formatVersion: 1,
  id: "owned",
  brand: "Opel",
  model: "Astra",
  year: 2024,
  createdAt: "2026-01-01",
  books: [],
};
const metadata = (file = "Old.svg", fetchedAt = Date.now() - 31 * DAY) => ({
  version: 1,
  fetchedAt,
  ttl: 30 * DAY,
  entity: "Q40966",
  logos: [{ file, rank: "normal" }],
});
const metadataFile = () => path.join(root, ".logos/brand-opel.json");

beforeEach(async () => {
  root = path.join(
    process.cwd(),
    "node_modules/.cache/glovebox-tests",
    `logos-${randomUUID()}`,
  );
  vi.stubEnv("MANUALS_DATABASE_DIR", root);
  await fs.mkdir(path.join(root, ".logos"), { recursive: true });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await fs.rm(root, { recursive: true, force: true });
});

describe("brand metadata refresh", () => {
  it("prewarms and corrects stale metadata without fetching an image", async () => {
    await fs.writeFile(metadataFile(), JSON.stringify(metadata()));
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input);
      expect(url.hostname).toBe("www.wikidata.org");
      if (url.searchParams.get("action") === "wbsearchentities")
        return Response.json({
          search: [
            {
              id: "Q40966",
              label: "Opel",
              description: "German automobile manufacturer",
            },
          ],
        });
      return Response.json({
        claims: {
          P154: [
            {
              rank: "normal",
              mainsnak: { datavalue: { value: "Corrected.svg" } },
            },
          ],
        },
      });
    });
    vi.stubGlobal("fetch", fetch);
    expect(await prewarmLogoMetadata([{ name: "Opel" }])).toEqual([]);
    expect(
      JSON.parse(await fs.readFile(metadataFile(), "utf8")).logos[0].file,
    ).toBe("Corrected.svg");
    fetch.mockClear();
    await prewarmLogoMetadata([{ name: "Opel" }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["offline", "invalid", "empty"])(
    "preserves last-good metadata on %s responses",
    async (mode) => {
      const original = metadata();
      await fs.writeFile(metadataFile(), JSON.stringify(original));
      const fetch = vi.fn(async () => {
        if (mode === "offline") throw new Error("offline");
        return Response.json(mode === "invalid" ? {} : { search: [] });
      });
      vi.stubGlobal("fetch", fetch);
      expect(await prewarmLogoMetadata([{ name: "Opel" }])).toEqual(["Opel"]);
      expect(JSON.parse(await fs.readFile(metadataFile(), "utf8"))).toEqual(
        original,
      );
      await prewarmLogoMetadata([{ name: "Opel" }]);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("refreshes metadata even if the old image is already cached", async () => {
    await fs.writeFile(metadataFile(), JSON.stringify(metadata()));
    const imageFile = path.join(
      root,
      ".logos",
      `${createHash("sha1").update("Old.svg").digest("hex")}.png`,
    );
    await fs.writeFile(imageFile, new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    let finish!: (response: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    expect((await getCarLogo(car))?.type).toBe("image/png");
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(Response.json({ search: [] }));
    await prewarmLogoMetadata([{ name: "Opel" }]);
  });

  it("bounds metadata prewarming to two concurrent lookups", async () => {
    let active = 0;
    let peak = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return Response.json({ search: [] });
      }),
    );
    await prewarmLogoMetadata(
      ["Opel", "Skoda", "Ford", "Fiat"].map((name) => ({ name })),
    );
    expect(peak).toBe(2);
  });
});
