import { beforeEach, describe, expect, it, vi } from "vitest";

// The catalogue lives on the network; the importer only needs its answers.
const catalog = vi.hoisted(() => ({
  resolveCatalogCar: vi.fn(),
  CatalogUnavailableError: class CatalogUnavailableError extends Error {},
}));
vi.mock("@/lib/server/catalog", () => catalog);

const { resolveCatalogCar, CatalogUnavailableError } = catalog;
const { ImportError, MAX_DOCUMENTS, MAX_FILE_BYTES, maxYear, validateImport } =
  await import("@/lib/server/importer");

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
