import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { carFile, bookIndex, section } from "./fixtures/database";
import { getCar } from "@/lib/content";
import { POST } from "@/app/api/cars/route";

// The catalogue lives on the network; the importer only needs its answers.
const catalog = vi.hoisted(() => ({
  resolveCatalogCar: vi.fn(),
  CatalogUnavailableError: class CatalogUnavailableError extends Error {},
}));
vi.mock("@/lib/server/catalog", () => catalog);
const python = vi.hoisted(() => ({ findPython: vi.fn(), run: vi.fn() }));
vi.mock("@/lib/server/python", () => python);

const { resolveCatalogCar, CatalogUnavailableError } = catalog;
const {
  ImportError,
  MAX_DOCUMENTS,
  MAX_FILE_BYTES,
  maxYear,
  validateImport,
  startImport,
  deleteCar,
  runningJob,
} = await import("@/lib/server/importer");

type Request = Parameters<typeof validateImport>[0];

function pdf(name = "instrukcja_cascada_2016.pdf", size?: number): File {
  const file = new File(["%PDF-1.7"], name, { type: "application/pdf" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

function request(extra: Partial<Request> = {}): Request {
  return {
    source: "other",
    brand: "  Opel ",
    model: "Cascada",
    year: 2016,
    docs: [{ file: pdf(), title: "" }],
    ...extra,
  };
}

async function rejection(req: Request) {
  const err = await validateImport(req).then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ImportError);
  return err as InstanceType<typeof ImportError>;
}

beforeEach(() => {
  resolveCatalogCar.mockReset();
});

describe("saved manual reuse", () => {
  let root: string;
  let originalManifest: string;
  const reuse = (extra: Partial<Request> = {}) =>
    request({
      brand: "Testowa",
      model: "Model",
      year: 2020,
      existingCar: "saved",
      bookOrder: ["second", "first"],
      docs: [],
      ...extra,
    });
  const readManifest = () =>
    fs.readFile(path.join(root, "saved", "car.json"), "utf8");
  async function settled(job: Awaited<ReturnType<typeof startImport>>) {
    await vi.waitFor(() => expect(job.state).not.toBe("running"));
    return job;
  }

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(process.cwd(), ".test-import-"));
    vi.stubEnv("MANUALS_DATABASE_DIR", root);
    vi.spyOn(os, "tmpdir").mockReturnValue(root);
    await fs.mkdir(path.join(root, "saved", "assets", "first"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(root, "saved", "assets", "first", "p1.webp"),
      "old",
    );
    const car = carFile("saved", ["first", "second"], { variant: "Wersja" });
    originalManifest = JSON.stringify(car);
    await fs.writeFile(path.join(root, "saved", "car.json"), originalManifest);
    for (const book of car.books) {
      await fs.mkdir(path.join(root, "saved", book.id));
      await fs.writeFile(
        path.join(root, "saved", book.id, "index.json"),
        JSON.stringify(bookIndex(book.id, [section(["intro"], "Wstęp", 1)])),
      );
    }
    python.findPython
      .mockReset()
      .mockResolvedValue({ best: { command: "python" } });
    python.run
      .mockReset()
      .mockImplementation(async (_command, args: string[]) => {
        const out = args[args.indexOf("--out") + 1];
        const assets = args[args.indexOf("--assets") + 1];
        const id = args[args.indexOf("--book") + 1];
        await fs.mkdir(out, { recursive: true });
        await fs.mkdir(assets, { recursive: true });
        await fs.writeFile(
          path.join(out, "index.json"),
          JSON.stringify(bookIndex(id, [])),
        );
        await fs.writeFile(path.join(assets, "p1.webp"), "new");
        return {
          code: 0,
          stdout: ": 40 pages\nsections: 3, chapters: 1, unique images: 1",
          stderr: "",
        };
      });
  });

  afterEach(async () => {
    await vi.waitFor(() => expect(runningJob()).toBeUndefined());
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("reuses all manuals, persists their order and does not need Python", async () => {
    python.findPython.mockResolvedValue({ best: undefined });
    const job = await startImport(reuse());
    expect(job).toMatchObject({
      carId: "saved",
      state: "done",
      pdfsDeleted: true,
    });
    expect(job.docs.map((d) => d.bookId)).toEqual(["second", "first"]);
    expect(job.docs.every((d) => d.size === 0)).toBe(true);
    expect(job.docs.map((d) => d.images)).toEqual([0, 1]);
    expect(job.docs.every((d) => d.pages === 40 && d.sections === 1)).toBe(
      true,
    );
    expect(getCar("saved")?.books.map((b) => b.id)).toEqual([
      "second",
      "first",
    ]);
    expect(JSON.parse(await readManifest()).variant).toBe("Wersja");
    expect(python.findPython).not.toHaveBeenCalled();
    expect(python.run).not.toHaveBeenCalled();
    expect(await fs.readdir(root)).toEqual(["saved"]);
  });

  it("accepts the multipart reuse and ordering interface", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      source: "other",
      brand: "Testowa",
      model: "Model",
      year: "2020",
      existingCar: "saved",
    }))
      form.set(key, value);
    form.append("bookOrder", "second");
    form.append("bookOrder", "first");
    const response = await POST(
      new globalThis.Request("http://localhost:3000/api/cars", {
        method: "POST",
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
        body: form,
      }),
    );
    expect(response.status).toBe(202);
    expect(
      (await response.json()).job.docs.map((d: { bookId: string }) => d.bookId),
    ).toEqual(["second", "first"]);
  });

  it.each([
    { existingCar: "../saved" },
    { existingCar: "" },
    { bookOrder: ["first", "../second"] },
    { bookOrder: ["first", "unknown"] },
    { bookOrder: ["first", "first"] },
    { bookOrder: ["first"] },
    { bookOrder: undefined },
    { brand: "Inna" },
    { model: "Inny" },
    { year: 2021 },
  ])("rejects unsafe, incomplete or mismatched reuse %o", async (extra) => {
    await expect(startImport(reuse(extra))).rejects.toMatchObject({
      status: 400,
    });
    expect(await readManifest()).toBe(originalManifest);
  });

  it("rejects missing cars and incompatible catalogue identity", async () => {
    await expect(
      startImport(reuse({ existingCar: "missing" })),
    ).rejects.toMatchObject({ status: 404 });
    resolveCatalogCar.mockResolvedValue({
      brand: "Inna",
      model: "Model",
      catalog: { brand: "TEST", model: "MODEL" },
    });
    await expect(
      startImport(reuse({ source: "catalog" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("enforces the limit across old and new manuals", async () => {
    await expect(
      startImport(
        reuse({
          docs: Array.from({ length: MAX_DOCUMENTS - 1 }, () => ({
            file: pdf(),
            title: "",
          })),
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(python.findPython).not.toHaveBeenCalled();
  });

  it("resolves catalogue identity without requiring saved catalogue metadata", async () => {
    resolveCatalogCar.mockResolvedValue({
      brand: "Testowa",
      model: "Model",
      catalog: { brand: "TEST", model: "MODEL" },
    });
    const job = await startImport(
      reuse({ source: "catalog", brand: "TEST", model: "MODEL" }),
    );
    expect(job.state).toBe("done");
    expect(JSON.parse(await readManifest()).catalog).toBeUndefined();
  });

  it("matches saved brand and model using the same normalized identity as the wizard", async () => {
    const car = JSON.parse(originalManifest);
    car.brand = "OPEL";
    car.model = "  Astra–Sports  Tourer ";
    await fs.writeFile(
      path.join(root, "saved", "car.json"),
      JSON.stringify(car),
    );
    resolveCatalogCar.mockResolvedValue({
      brand: "Opel",
      model: "Astra Sports Tourer",
      catalog: { brand: "OPEL", model: "ASTRA" },
    });
    const job = await startImport(
      reuse({ source: "catalog", brand: "OPEL", model: "ASTRA" }),
    );
    expect(job.state).toBe("done");
    const saved = JSON.parse(await readManifest());
    expect(saved.brand).toBe("OPEL");
    expect(saved.model).toBe("  Astra–Sports  Tourer ");
  });

  it("rejects symbolic car and asset folders", async () => {
    await fs.rename(path.join(root, "saved"), path.join(root, "real"));
    await fs.symlink(path.join(root, "real"), path.join(root, "saved"), "dir");
    await expect(startImport(reuse())).rejects.toMatchObject({ status: 400 });
    await fs.unlink(path.join(root, "saved"));
    await fs.rename(path.join(root, "real"), path.join(root, "saved"));
    await fs.rename(
      path.join(root, "saved", "assets"),
      path.join(root, "real-assets"),
    );
    await fs.symlink(
      path.join(root, "real-assets"),
      path.join(root, "saved", "assets"),
      "dir",
    );
    await expect(startImport(reuse())).rejects.toMatchObject({ status: 400 });
    expect(await readManifest()).toBe(originalManifest);
  });

  it("rejects unsafe saved book paths and invalid uploads without changing the car", async () => {
    const car = JSON.parse(originalManifest);
    car.books[0].id = "../escape";
    await fs.writeFile(
      path.join(root, "saved", "car.json"),
      JSON.stringify(car),
    );
    await expect(startImport(reuse())).rejects.toMatchObject({ status: 400 });
    await fs.writeFile(path.join(root, "saved", "car.json"), originalManifest);
    await expect(
      startImport(
        reuse({
          docs: [{ file: new File(["not pdf"], "invalid.pdf"), title: "New" }],
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await readManifest()).toBe(originalManifest);
    expect(await fs.readdir(root)).toEqual(["saved"]);
  });

  it("keeps the previous order if an atomic reorder fails", async () => {
    vi.spyOn(fs, "rename").mockRejectedValue(
      new Error("Zapis nie powiódł się."),
    );
    await expect(startImport(reuse())).rejects.toThrow(
      "Zapis nie powiódł się.",
    );
    expect(await readManifest()).toBe(originalManifest);
    expect(await fs.readdir(root)).toEqual(["saved"]);
  });

  it("appends with unique ids while preserving existing content and metadata", async () => {
    const job = await settled(
      await startImport(
        reuse({
          docs: [
            { file: pdf(), title: "First" },
            { file: pdf("other.pdf"), title: "First" },
          ],
        }),
      ),
    );
    expect(job.state).toBe("done");
    expect(job.docs.map((d) => d.bookId)).toEqual([
      "second",
      "first",
      "first-2",
      "first-3",
    ]);
    const manifest = JSON.parse(await readManifest());
    expect(manifest.books.map((b: { id: string }) => b.id)).toEqual(
      job.docs.map((d) => d.bookId),
    );
    expect(manifest.createdAt).toBe(JSON.parse(originalManifest).createdAt);
    expect(manifest.variant).toBe("Wersja");
    expect(
      await fs.readFile(
        path.join(root, "saved", "assets", "first", "p1.webp"),
        "utf8",
      ),
    ).toBe("old");
    expect(
      await fs.readFile(
        path.join(root, "saved", "assets", "first-2", "p1.webp"),
        "utf8",
      ),
    ).toBe("new");
    expect(job.pdfsDeleted).toBe(true);
    expect(await fs.readdir(root)).toEqual(["saved"]);
  });

  it("leaves saved content untouched if extraction fails", async () => {
    python.run.mockResolvedValue({
      code: 1,
      stdout: "",
      stderr: "Błąd odczytu",
    });
    const job = await settled(
      await startImport(reuse({ docs: [{ file: pdf(), title: "New" }] })),
    );
    expect(job.state).toBe("error");
    expect(await readManifest()).toBe(originalManifest);
    expect((await fs.readdir(path.join(root, "saved"))).sort()).toEqual([
      "assets",
      "car.json",
      "first",
      "second",
    ]);
    expect(job.pdfsDeleted).toBe(true);
  });

  it("rolls back moved manuals and assets if the manifest commit fails", async () => {
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, "rename").mockImplementation(async (source, target) => {
      if (String(source).endsWith("car.json"))
        throw new Error("Zapis nie powiódł się.");
      return rename(source, target);
    });
    const job = await settled(
      await startImport(reuse({ docs: [{ file: pdf(), title: "New" }] })),
    );
    expect(job.state).toBe("error");
    expect(await readManifest()).toBe(originalManifest);
    expect(await fs.readdir(path.join(root, "saved", "assets"))).toEqual([
      "first",
    ]);
    expect((await fs.readdir(path.join(root, "saved"))).sort()).toEqual([
      "assets",
      "car.json",
      "first",
      "second",
    ]);
    expect(await fs.readdir(root)).toEqual(["saved"]);
  });

  it("reserves validation and setup against imports, deletion and reorder", async () => {
    let release!: (value: {
      brand: string;
      model: string;
      catalog: { brand: string; model: string };
    }) => void;
    resolveCatalogCar.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const pending = startImport(request({ source: "catalog" }));
    expect(runningJob()).toBeDefined();
    await expect(startImport(reuse())).rejects.toMatchObject({ status: 409 });
    await expect(deleteCar("saved")).rejects.toMatchObject({ status: 409 });
    release({
      brand: "Opel",
      model: "Cascada",
      catalog: { brand: "OPEL", model: "CASCADA" },
    });
    const job = await settled(await pending);
    expect(job.state).toBe("done");
    expect(job.carId).not.toBe("saved");
  });

  it("keeps the lock during extraction and releases it after failure", async () => {
    let release!: (value: {
      code: number;
      stdout: string;
      stderr: string;
    }) => void;
    python.run.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const job = await startImport(
      reuse({ docs: [{ file: pdf(), title: "New" }] }),
    );
    await vi.waitFor(() => expect(python.run).toHaveBeenCalled());
    await expect(deleteCar("saved")).rejects.toMatchObject({ status: 409 });
    await expect(startImport(reuse())).rejects.toMatchObject({ status: 409 });
    release({ code: 1, stdout: "", stderr: "" });
    await settled(job);
    expect((await startImport(reuse())).state).toBe("done");
  });
});

describe("import validation", () => {
  it("accepts a hand-typed car and derives missing book titles", async () => {
    const valid = await validateImport(
      request({ variant: " 1.6 Turbo ", docs: [{ file: pdf(), title: "" }] }),
    );
    expect(valid).toMatchObject({
      brand: "Opel",
      model: "Cascada",
      year: 2016,
      variant: "1.6 Turbo",
      docs: [{ title: "instrukcja cascada 2016" }],
    });

    expect(valid.catalog).toBeUndefined();
  });

  it("accepts a catalogue model with a manually selected older year", async () => {
    const valid = await validateImport(
      request({ source: "other", brand: "Seat", model: "Ibiza", year: 2008 }),
    );
    expect(valid).toMatchObject({
      brand: "Seat",
      model: "Ibiza",
      year: 2008,
    });
    expect(valid.catalog).toBeUndefined();
    expect(resolveCatalogCar).not.toHaveBeenCalled();
  });

  it.each([
    [{ brand: " " }, "Podaj markę auta."],
    [{ model: "" }, "Podaj model auta."],
    [{ year: 1900 }, "Podaj prawidłowy rocznik."],
    [{ year: 2016.5 }, "Podaj prawidłowy rocznik."],
    [{ year: maxYear() + 1 }, "Podaj prawidłowy rocznik."],
    [
      { source: "nope" as Request["source"] },
      "Wybierz markę z listy albo „Inna”.",
    ],
    [{ docs: [] }, "Dodaj co najmniej jeden plik PDF."],
  ])("rejects %o", async (extra, message) => {
    expect((await rejection(request(extra))).message).toBe(message);
  });

  it("enforces the document limits", async () => {
    const many = Array.from({ length: MAX_DOCUMENTS + 1 }, () => ({
      file: pdf(),
      title: "",
    }));
    expect((await rejection(request({ docs: many }))).message).toMatch(
      String(MAX_DOCUMENTS),
    );
    const text = new File(["x"], "notatki.txt", { type: "text/plain" });
    expect(
      (await rejection(request({ docs: [{ file: text, title: "" }] }))).message,
    ).toContain("nie jest plikiem PDF");
    expect(
      (
        await rejection(
          request({ docs: [{ file: pdf("a.pdf", 0), title: "" }] }),
        )
      ).message,
    ).toContain("jest pusty");
    const big = pdf("duzy.pdf", MAX_FILE_BYTES + 1);
    expect(
      (await rejection(request({ docs: [{ file: big, title: "" }] }))).message,
    ).toContain("za duży");
  });

  it("checks catalogue cars against the official list", async () => {
    resolveCatalogCar.mockResolvedValue({
      brand: "Opel",
      model: "Cascada",
      catalog: { brand: "OPEL", model: "CASCADA" },
    });
    const valid = await validateImport(
      request({ source: "catalog", brand: "OPEL", variant: "ignored" }),
    );
    expect(resolveCatalogCar).toHaveBeenCalledWith({
      brand: "OPEL",
      model: "Cascada",
      year: 2016,
    });
    expect(valid.catalog).toEqual({ brand: "OPEL", model: "CASCADA" });
    expect(valid.variant).toBeUndefined();

    resolveCatalogCar.mockResolvedValue("Tego rocznika nie ma w katalogu.");
    expect((await rejection(request({ source: "catalog" }))).message).toBe(
      "Tego rocznika nie ma w katalogu.",
    );

    resolveCatalogCar.mockImplementation(async () => {
      throw new CatalogUnavailableError("Katalog jest niedostępny.");
    });
    const unavailable = await rejection(request({ source: "catalog" }));
    expect(unavailable.status).toBe(503);
  });
});
