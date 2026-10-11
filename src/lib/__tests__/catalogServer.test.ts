import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CatalogUnavailableError,
  prewarmEuropeanCatalog,
} from "@/lib/server/catalog";

const memory = vi.hoisted(() => ({
  files: new Map<string, string>(),
  root: "",
}));

vi.mock("@/lib/content", () => ({
  getDatabaseDir: () => memory.root,
}));
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn(),
    readFile: async (file: string) => {
      const value = memory.files.get(file);
      if (value === undefined) throw new Error("Missing cache");
      return value;
    },
    writeFile: async (file: string, value: string) => {
      memory.files.set(file, value);
    },
    rename: async (from: string, to: string) => {
      memory.files.set(to, memory.files.get(from)!);
      memory.files.delete(from);
    },
    rm: async (file: string) => {
      memory.files.delete(file);
    },
  },
}));

const mainTable = "[CO2Emission].[latest].[co2cars]";
const cacheFile = (name: string) =>
  path.join(memory.root, ".catalog", `${name}.json`);
const snapshot = (value: unknown, savedAt = Date.now()) => ({
  version: 3,
  savedAt,
  ttl: 7 * 24 * 60 * 60 * 1000,
  value,
});
const modelRow = { Cn: "YARIS HYBRID", Year: 2022, n: 10000 };

function mockEea(
  models: unknown,
  makes: unknown = [{ Mk: "TOYOTA", n: 20000 }],
) {
  return vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const request = new URL(url);
      if (request.hostname !== "discodata.eea.europa.eu")
        return Response.json({ Results: [] });
      const query = request.searchParams.get("query")!;
      if (query.includes("GROUP BY Mk"))
        return Response.json({ results: makes });
      if (query.includes("GROUP BY Cn")) return Response.json(models);
      throw new Error(`Unexpected query: ${query}`);
    }),
  );
}

beforeEach(() => {
  memory.files.clear();
  memory.root = `catalogue-test-${crypto.randomUUID()}`;
  memory.files.set(
    cacheFile("tables"),
    JSON.stringify(snapshot([{ name: mainTable, years: [2022] }])),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("EEA source row validation", () => {
  it("prepares usable Toyota models despite missing commercial and make names", async () => {
    mockEea(
      {
        results: [
          { Cn: null, Year: 2022, n: 100 },
          { Cn: "", Year: 2022, n: 200 },
          { Cn: " \t ", Year: 2022, n: 300 },
          modelRow,
          { Cn: "COROLLA", Year: 2021, n: 10000 },
        ],
      },
      [
        { Mk: null, n: 100 },
        { Mk: "", n: 200 },
        { Mk: " \t ", n: 300 },
        { Mk: "TOYOTA", n: 20000 },
      ],
    );
    expect(await prewarmEuropeanCatalog()).toMatchObject({
      brands: [{ id: "TOYOTA", name: "Toyota" }],
      failed: [],
    });
    const { value } = JSON.parse(
      memory.files.get(cacheFile("models-eu-TOYOTA"))!,
    );
    expect(value.models).toEqual([
      { id: "COROLLA", name: "Corolla", years: [2021] },
      { id: "YARIS", name: "Yaris", years: [2022] },
    ]);
  });

  const malformedRows = [
    null,
    [],
    { ...modelRow, Cn: 123 },
    { ...modelRow, Cn: {} },
    { ...modelRow, Cn: undefined },
    { ...modelRow, Year: null },
    { ...modelRow, Year: "2022" },
    { ...modelRow, Year: 2022.5 },
    { ...modelRow, Year: 1949 },
    { ...modelRow, Year: 9999 },
    { ...modelRow, Year: undefined },
    { ...modelRow, n: null },
    { ...modelRow, n: "10000" },
    { ...modelRow, n: -1 },
    { ...modelRow, n: 1.5 },
    { ...modelRow, n: NaN },
    { ...modelRow, n: Infinity },
    { ...modelRow, n: undefined },
  ];

  it.each(malformedRows)("rejects malformed model row %j", async (row) => {
    mockEea({ results: [modelRow, row] });
    expect(await prewarmEuropeanCatalog()).toMatchObject({
      failed: ["Toyota"],
    });
    expect(memory.files.has(cacheFile("models-eu-TOYOTA"))).toBe(false);
  });

  it.each([
    {},
    { results: null },
    { results: {} },
    { results: [] },
    { results: [{ Cn: "", Year: 2022, n: 100 }] },
    { results: [modelRow], errors: [{ error: "Query failed" }] },
    ...malformedRows.map((row) => ({ results: [modelRow, row] })),
  ])(
    "preserves a last-good model snapshot for invalid response %j",
    async (body) => {
      const original = JSON.stringify(
        snapshot(
          {
            models: [{ id: "YARIS", name: "Yaris", years: [2021] }],
            aliases: {},
          },
          Date.now() - 15 * 24 * 60 * 60 * 1000,
        ),
      );
      memory.files.set(cacheFile("models-eu-TOYOTA"), original);
      mockEea(body);
      expect(await prewarmEuropeanCatalog()).toMatchObject({ failed: [] });
      expect(memory.files.get(cacheFile("models-eu-TOYOTA"))).toBe(original);
    },
  );

  it.each([123, {}, undefined])("rejects malformed make %j", async (Mk) => {
    mockEea({ results: [modelRow] }, [{ Mk, n: 20000 }]);
    await expect(prewarmEuropeanCatalog()).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
    expect(memory.files.has(cacheFile("brands"))).toBe(false);
  });
});
