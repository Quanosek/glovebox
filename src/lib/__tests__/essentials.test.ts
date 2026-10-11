import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Block } from "@/content/types";
import { getCarOverview } from "@/lib/carOverview";
import { getCar } from "@/lib/content";
import {
  bookIndex,
  carFile,
  chapter,
  createDatabase,
  section,
  type TestDatabase,
} from "./fixtures/database";

let db: TestDatabase;
let previous: string | undefined;

const heading = (id: string, text: string): Block => ({
  type: "heading",
  id,
  level: 2,
  runs: [text],
});

beforeAll(() => {
  previous = process.env.MANUALS_DATABASE_DIR;
  db = createDatabase();
  process.env.MANUALS_DATABASE_DIR = db.root;

  // Seven topics as headings of one chapter: 6 tiles fill whole rows.
  db.write("many/car.json", carFile("many", ["manual"]));
  db.write(
    "many/manual/index.json",
    bookIndex("manual", [section(["porady"], "Porady praktyczne", 3)]),
  );
  db.write(
    "many/manual/porady.json",
    chapter({
      porady: [
        "Ciśnienie w oponach",
        "Zmiana koła",
        "Bezpieczniki",
        "Wymiana żarówek",
        "Olej silnikowy",
        "Tankowanie",
        "Lampki kontrolne",
      ].map((text, i) => heading(`b${i + 1}`, text)),
    }),
  );

  // One known topic: chapters fill the tiles up to four.
  db.write("few/car.json", carFile("few", ["manual"]));
  db.write(
    "few/manual/index.json",
    bookIndex("manual", [
      section(["bezpieczniki"], "Bezpieczniki", 2),
      section(["radio"], "Radio", 10),
      section(["radio", "stacje"], "Stacje", 11),
      section(["klimatyzacja"], "Klimatyzacja", 20),
      section(["nawigacja"], "Nawigacja", 30),
      section(["drzwi"], "Drzwi", 40),
    ]),
  );
  for (const slug of [
    "bezpieczniki",
    "radio",
    "klimatyzacja",
    "nawigacja",
    "drzwi",
  ])
    db.write(`few/manual/${slug}.json`, chapter({}));
});

afterAll(() => {
  db.remove();
  if (previous === undefined) delete process.env.MANUALS_DATABASE_DIR;
  else process.env.MANUALS_DATABASE_DIR = previous;
});

describe("Niezbędnik tiles", () => {
  it("links every topic to its heading and keeps whole rows", () => {
    const tiles = getCarOverview(getCar("many")!).essentials;
    expect(tiles.map((t) => [t.id, t.href.split("#")[1]])).toEqual([
      ["indicators", "b7"],
      ["tyres", "b1"],
      ["wheel", "b2"],
      ["fuses", "b3"],
      ["bulbs", "b4"],
      ["fluids", "b5"],
    ]);
    expect(new Set(tiles.map((t) => t.href)).size).toBe(tiles.length);
    for (const t of tiles) {
      expect(t.href).toMatch(/^\/auto\/many\/manual\/porady#b\d+$/);
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.source).toMatch(/^Porady praktyczne › /);
    }
  });

  it("fills up to four tiles with chapters of the manual", () => {
    const tiles = getCarOverview(getCar("few")!).essentials;
    expect(tiles.map((t) => [t.id, t.label])).toEqual([
      ["fuses", "Bezpieczniki"],
      ["chapter", "Radio"],
      ["chapter", "Klimatyzacja"],
      ["chapter", "Nawigacja"],
    ]);
    expect(tiles[1]).toMatchObject({
      href: "/auto/few/manual/radio",
      description: "Rozdział instrukcji od str. 10.",
    });
  });
});
