import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getBlocks,
  getBook,
  getBookCtx,
  getCar,
  getCarUrls,
  getCarVersion,
  getPrevNext,
  getSearchDocs,
  getSection,
  getTocTree,
  listCarSummaries,
  listCars,
  resolvePageRef,
  type BookCtx,
} from "@/lib/content";
import {
  bookIndex,
  carFile,
  chapter,
  createDatabase,
  section,
  type TestDatabase,
} from "./fixtures/database";

const ICON = "/media/test-auto/manual/symbole/s-1.webp";
const CELL_ICON = "/media/test-auto/manual/symbole/s-2.webp";
const WARNING_ICON = "/media/test-auto/manual/symbole/s-3.webp";
const FIGURE = "/media/test-auto/manual/drzwi/p005-01.webp";

let db: TestDatabase;
let previous: string | undefined;

beforeAll(() => {
  previous = process.env.MANUALS_DATABASE_DIR;
  db = createDatabase();
  process.env.MANUALS_DATABASE_DIR = db.root;

  db.write("test-auto/car.json", carFile("test-auto", ["manual"]));
  db.write(
    "test-auto/manual/index.json",
    bookIndex("manual", [
      section(["drzwi"], "Drzwi", 5),
      section(["drzwi", "zamek"], "Zamek", 6),
      section(["swiatla"], "Światła", 10),
    ]),
  );
  db.write(
    "test-auto/manual/drzwi.json",
    chapter({
      drzwi: [
        {
          type: "paragraph",
          id: "b1",
          runs: ["Nacisnąć ", { icon: ICON, w: 10, h: 10 }, "."],
          page: 5,
        },
        {
          type: "image",
          id: "b2",
          src: FIGURE,
          width: 800,
          height: 500,
          alt: "Rys. 1 Drzwi",
          caption: ["Rys. 1 Drzwi kierowcy"],
          page: 5,
        },
      ],
      "drzwi/zamek": [
        {
          type: "table",
          id: "b1",
          header: true,
          rows: [
            ["Symbol", "Znaczenie"],
            ["", "Zamek otwarty"],
          ],
          cells: [
            [["Symbol"], ["Znaczenie"]],
            [[{ icon: CELL_ICON, w: 12, h: 12 }], ["Zamek otwarty"]],
          ],
          page: 7,
        },
        {
          type: "warning",
          id: "b2",
          kind: "warning",
          title: "Ostrzeżenie",
          blocks: [
            {
              type: "list",
              id: "b2-1",
              ordered: false,
              items: [
                [
                  { icon: WARNING_ICON, w: 8, h: 8 },
                  " Nie zostawiać kluczyka.",
                ],
              ],
            },
          ],
          page: 8,
        },
      ],
    }),
  );
  db.write(
    "test-auto/manual/swiatla.json",
    chapter({
      swiatla: [
        { type: "paragraph", id: "b1", runs: ["Światła mijania."], page: 10 },
      ],
    }),
  );

  // A car whose only manual has no extracted content is not offered.
  db.write("placeholder-auto/car.json", carFile("placeholder-auto", ["empty"]));
  db.write(
    "placeholder-auto/empty/index.json",
    bookIndex("empty", [], { placeholder: true }),
  );
  // Folders that are not cars are ignored.
  db.write("Bad_Name/car.json", carFile("Bad_Name", []));
  db.write("other-id/car.json", carFile("not-the-folder", []));
  db.write(".import-123/car.json", carFile("import", []));
});

afterAll(() => {
  db.remove();
  if (previous === undefined) delete process.env.MANUALS_DATABASE_DIR;
  else process.env.MANUALS_DATABASE_DIR = previous;
});

function ctx(): BookCtx {
  const found = getBookCtx("test-auto", "manual");
  if (!found) throw new Error("missing fixture book");
  return found;
}

describe("database reader", () => {
  it("lists only valid car folders whose car.json matches the folder", () => {
    expect(listCars().map((c) => c.id)).toEqual([
      "placeholder-auto",
      "test-auto",
    ]);
    expect(getCar("Bad_Name")).toBeUndefined();
    expect(getCar("../test-auto")).toBeUndefined();
    expect(getCar("other-id")).toBeUndefined();
  });

  it("offers only cars with a readable manual", () => {
    const summaries = listCarSummaries();
    expect(summaries.map((c) => c.id)).toEqual(["test-auto"]);
    expect(summaries[0].books).toEqual([
      expect.objectContaining({
        id: "manual",
        href: "/auto/test-auto/manual",
        sections: 3,
        pages: 40,
        placeholder: false,
      }),
    ]);
  });

  it("resolves books, sections and the reading order", () => {
    expect(getBookCtx("test-auto", "missing")).toBeUndefined();
    const book = ctx();
    const lock = getSection(book, ["drzwi", "zamek"]);
    expect(lock?.title).toBe("Zamek");
    expect(getSection(book, ["drzwi%2Fzamek"])?.id).toBe("drzwi/zamek");
    const { prev, next } = getPrevNext(book, lock!);
    expect([prev?.id, next?.id]).toEqual(["drzwi", "swiatla"]);
    expect(getBlocks(book, lock!).map((b) => b.type)).toEqual([
      "table",
      "warning",
    ]);
  });

  it("builds the nested table of contents", () => {
    const toc = getTocTree(ctx());
    expect(toc.map((n) => n.title)).toEqual(["Drzwi", "Światła"]);
    expect(toc[0].children.map((n) => n.href)).toEqual([
      "/auto/test-auto/manual/drzwi/zamek",
    ]);
  });

  it("links printed page numbers to the first block of that page", () => {
    const book = ctx();
    expect(resolvePageRef(book, 5)).toBe("/auto/test-auto/manual/drzwi");
    expect(resolvePageRef(book, 7)).toBe(
      "/auto/test-auto/manual/drzwi/zamek#b1",
    );
    // A page without its own block falls back to an earlier page.
    expect(resolvePageRef(book, 9)).toBe(
      "/auto/test-auto/manual/drzwi/zamek#b2",
    );
    expect(resolvePageRef(book, 30)).toBeNull();
  });

  it("collects every page and image of a car for its offline copy", () => {
    const urls = getCarUrls(getCar("test-auto")!);
    expect(urls).toEqual(
      expect.arrayContaining([
        "/auto/test-auto",
        "/auto/test-auto/manual",
        "/auto/test-auto/manual/drzwi",
        "/auto/test-auto/manual/drzwi/zamek",
        "/auto/test-auto/manual/swiatla",
        ICON,
        FIGURE,
        CELL_ICON,
        WARNING_ICON,
      ]),
    );
  });

  it("indexes section text, table rows and captions for search", () => {
    const docs = getSearchDocs(getCar("test-auto")!);
    const lock = docs.find((d) => d.id === "manual:drzwi/zamek");
    expect(lock?.path).toBe("Drzwi");
    expect(lock?.text).toContain("Zamek otwarty");
    expect(lock?.text).toContain("Nie zostawiać kluczyka.");
    expect(docs.find((d) => d.id === "manual:drzwi")?.text).toContain(
      "Rys. 1 Drzwi kierowcy",
    );
  });

  it("re-reads files changed on disk and changes the offline version", () => {
    const car = getCar("test-auto")!;
    const before = getCarVersion(car);
    const file = db.write(
      "test-auto/manual/index.json",
      bookIndex("manual", [section(["drzwi"], "Drzwi przednie", 5)]),
    );
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(file, later, later);
    expect(getBook(ctx()).sections.map((s) => s.title)).toEqual([
      "Drzwi przednie",
    ]);
    expect(getCarVersion(car)).not.toBe(before);
  });
});
