import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCarLogo,
  prewarmLogoMetadata,
  WIKIDATA_PACING,
} from "@/lib/server/logos";
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
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const opelSearch = () =>
  Response.json({
    search: [
      {
        id: "Q40966",
        label: "Opel",
        description: "German automobile manufacturer",
      },
    ],
  });
const opelClaims = () =>
  Response.json({
    claims: {
      P154: [
        { rank: "normal", mainsnak: { datavalue: { value: "Opel.svg" } } },
      ],
    },
  });
/** Wikidata + Commons stub; `limited` 429 answers come first. */
function wikimedia(limited = 0, retryAfter?: string) {
  return vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.hostname === "commons.wikimedia.org") return new Response(PNG);
    if (limited-- > 0)
      return new Response("", {
        status: 429,
        headers: retryAfter ? { "Retry-After": retryAfter } : {},
      });
    return url.searchParams.get("action") === "wbsearchentities"
      ? opelSearch()
      : opelClaims();
  });
}

beforeEach(async () => {
  root = path.join(os.tmpdir(), `glovebox-logos-${randomUUID()}`);
  vi.stubEnv("MANUALS_DATABASE_DIR", root);
  await fs.mkdir(path.join(root, ".logos"), { recursive: true });
  Object.assign(WIKIDATA_PACING, {
    intervalMs: 0,
    retryBaseMs: 1,
    maxRetryWaitMs: 50,
  });
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

  it("distinguishes a successful missing logo from failed requests on repeated runs", async () => {
    const fetch = vi.fn(async () => Response.json({ search: [] }));
    vi.stubGlobal("fetch", fetch);
    const diagnostic = vi.fn();
    expect(await prewarmLogoMetadata([{ name: "Opel" }], diagnostic)).toEqual(
      [],
    );
    expect(diagnostic).not.toHaveBeenCalled();
    expect(JSON.parse(await fs.readFile(metadataFile(), "utf8")).ttl).toBe(
      7 * DAY,
    );
    await prewarmLogoMetadata([{ name: "Opel" }], diagnostic);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retains HTTP diagnostics and the hourly retry for failed first lookups", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetch);
    const diagnostic = vi.fn();
    expect(await prewarmLogoMetadata([{ name: "Opel" }], diagnostic)).toEqual([
      "Opel",
    ]);
    expect(diagnostic).toHaveBeenCalledWith("Wikidata HTTP 429");
    expect(fetch).toHaveBeenCalledTimes(WIKIDATA_PACING.attempts);
    const original = await fs.readFile(metadataFile(), "utf8");
    await prewarmLogoMetadata([{ name: "Opel" }], diagnostic);
    expect(fetch).toHaveBeenCalledTimes(WIKIDATA_PACING.attempts);
    expect(await fs.readFile(metadataFile(), "utf8")).toBe(original);
    expect(JSON.parse(original)).toMatchObject({
      ttl: DAY / 24,
      failure: "Wikidata HTTP 429",
    });
  });
});

describe("Wikidata rate limits", () => {
  it("serves a previous-version entry at once and re-parses it in the background", async () => {
    await fs.writeFile(
      metadataFile(),
      JSON.stringify(metadata("Old.svg", Date.now())),
    );
    const fetch = wikimedia();
    vi.stubGlobal("fetch", fetch);
    expect(await getCarLogo(car)).not.toBeNull();
    await prewarmLogoMetadata([{ name: "Opel" }]);
    expect(JSON.parse(await fs.readFile(metadataFile(), "utf8"))).toMatchObject(
      { version: 2, logos: [{ file: "Opel.svg" }] },
    );
  });
  it("waits and retries after HTTP 429 instead of recording a missing logo", async () => {
    const fetch = wikimedia(2);
    vi.stubGlobal("fetch", fetch);
    expect(await prewarmLogoMetadata([{ name: "Opel" }])).toEqual([]);
    expect(JSON.parse(await fs.readFile(metadataFile(), "utf8"))).toMatchObject(
      { entity: "Q40966", logos: [{ file: "Opel.svg" }] },
    );
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("honours Retry-After before the next request", async () => {
    const started: number[] = [];
    const inner = wikimedia(1, "0.03");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        started.push(Date.now());
        return inner(input);
      }),
    );
    await prewarmLogoMetadata([{ name: "Opel" }]);
    expect(started[1] - started[0]).toBeGreaterThanOrEqual(25);
  });

  it("does not let another process's rate-limit failure hide a car's logo", async () => {
    await fs.writeFile(
      metadataFile(),
      JSON.stringify({
        version: 1,
        fetchedAt: Date.now() - 60_000,
        ttl: DAY / 24,
        entity: null,
        logos: [],
        failure: "Wikidata HTTP 429",
      }),
    );
    vi.stubGlobal("fetch", wikimedia());
    expect((await getCarLogo({ ...car, brand: "Opel" }))?.type).toBe(
      "image/png",
    );
    expect(
      JSON.parse(await fs.readFile(metadataFile(), "utf8")).failure,
    ).toBeUndefined();
  });

  it("keeps this process's own hourly back-off after a failed retry", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetch);
    expect(await getCarLogo(car)).toBeNull();
    const calls = fetch.mock.calls.length;
    expect(await getCarLogo(car)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
});
