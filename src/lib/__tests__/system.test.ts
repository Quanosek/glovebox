import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/system/route";
import { findPython } from "@/lib/server/python";
import { engines } from "../../../package.json";

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/content", () => ({
  getDatabaseDir: () => "/virtual/manuals",
  listCarSummaries: () => [],
}));
vi.mock("@/lib/server/python", () => ({
  findPython: vi.fn().mockResolvedValue({ best: null, found: [] }),
}));
vi.mock("@/lib/server/importer", () => ({
  MAX_DOCUMENTS: 10,
  MAX_FILE_BYTES: 250 * 1024 * 1024,
  runningJob: () => null,
}));

const nodeVersion = process.versions.node;

afterEach(() => {
  Object.defineProperty(process.versions, "node", { value: nodeVersion });
  vi.clearAllMocks();
});

describe("installation check", () => {
  it("declares minimum versions without an upper bound", () => {
    expect(engines).toEqual({
      node: ">=22.22.2",
      pnpm: ">=10.26.0",
    });
  });

  it.each([
    ["20.9.0", false],
    ["22.22.0", false],
    ["22.22.1", false],
    ["22.22.2", true],
    ["22.23.0", true],
    ["23.0.0", true],
    ["24.0.0", true],
    ["24.20.0", true],
    ["25.0.0", true],
    ["26.0.0", true],
  ])(
    "checks the Node minimum without blocking newer versions: %s",
    async (version, ready) => {
      Object.defineProperty(process.versions, "node", { value: version });
      const response = await GET(
        new Request("http://localhost:3000/api/system", {
          headers: { host: "localhost:3000" },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        nodeReady: ready,
        pythonReady: false,
        extractor: true,
        database: { writable: true },
        manuals: { count: 0 },
        localAccess: true,
        runningJob: null,
      });
      expect(findPython).toHaveBeenCalledWith(true);
    },
  );
});
