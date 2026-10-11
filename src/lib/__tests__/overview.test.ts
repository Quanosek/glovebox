import { describe, expect, it } from "vitest";
import {
  ESSENTIALS,
  TECHNICAL_SECTION,
  essentialsSize,
  pickEssential,
  type EssentialCandidate,
  type EssentialId,
} from "@/config/essentials";
import type { Block } from "@/content/types";
import {
  firstIllustration,
  hasMeasurement,
  isMeasurementTable,
  isNumeric,
  kwToHp,
  shorten,
  specParts,
  tableFacts,
  textFacts,
} from "@/lib/overview";

const icon = (id: string): Block => ({
  type: "image",
  id,
  src: `/media/car/book/ch/${id}.webp`,
  width: 24,
  height: 24,
  alt: "",
  icon: true,
});

const topic = (id: EssentialId) => ESSENTIALS.find((t) => t.id === id)!;
const section = (chain: string): EssentialCandidate => ({
  title: chain.split(" › ").at(-1)!,
  chain,
  section: true,
});
const heading = (chain: string, title: string): EssentialCandidate => ({
  title,
  chain,
  section: false,
});
const pick = (id: EssentialId, candidates: EssentialCandidate[]) => {
  const hit = pickEssential(topic(id), candidates);
  return hit && (hit.section ? hit.chain : `${hit.chain} › ${hit.title}`);
};

describe("Niezbędnik topics", () => {
  it("opens the heading of the topic inside a shared section", () => {
    const shared = "Sytuacje awaryjne › Bezpieczniki i żarówki";
    const candidates = [
      section(shared),
      heading(shared, "Bezpieczniki"),
      heading(shared, "Wymiana żarówek"),
    ];
    expect(pick("fuses", candidates)).toBe(`${shared} › Bezpieczniki`);
    expect(pick("bulbs", candidates)).toBe(`${shared} › Wymiana żarówek`);
  });

  it("prefers a fitting chapter over the first mention in reading order", () => {
    expect(
      pick("tyres", [
        heading(
          "Uruchomienie i prowadzenie pojazdu",
          "Sprawdzanie ciśnienia w oponach",
        ),
        heading("Zaczep holowniczy", "Ciśnienie w oponach"),
        heading("Porady praktyczne › Koła", "Ciśnienie w oponach"),
        heading("Koła i opony", "Układ monitorowania ciśnienia w oponach"),
      ]),
    ).toBe("Porady praktyczne › Koła › Ciśnienie w oponach");
    expect(
      pick("indicators", [
        heading("Pasy bezpieczeństwa", "Lampki kontrolne"),
        section("Obsługa › Wskaźniki i lampki ostrzegawcze/kontrolne"),
      ]),
    ).toBe("Obsługa › Wskaźniki i lampki ostrzegawcze/kontrolne");
  });

  it("uses a weaker title only without a stronger one", () => {
    const service = [
      section("Ogrzewanie, wentylacja i klimatyzacja › Obsługa okresowa"),
      section("Serwisowanie samochodu"),
    ];
    expect(pick("service", service)).toBe("Serwisowanie samochodu");
    expect(pick("service", service.slice(0, 1))).toBeUndefined();
    expect(
      pick("service", [
        heading("Bezpieczne przewożenie dzieci", "Przegląd systemów mocowania"),
      ]),
    ).toBeUndefined();
    expect(
      pick("help", [
        heading(
          "Sytuacje awaryjne › Poradnik",
          "Wyposażenie używane w sytuacjach awaryjnych",
        ),
        section("Sytuacje awaryjne"),
      ]),
    ).toBe("Sytuacje awaryjne");
  });

  it("skips misleading titles", () => {
    expect(pick("bulbs", [section("Lampki kontrolne")])).toBeUndefined();
    expect(pick("fuel", [section("Wskaźnik poziomu paliwa")])).toBeUndefined();
    expect(
      pick("fluids", [
        heading("Bezpieczniki i żarówki", "Bezpieczniki w komorze silnika"),
      ]),
    ).toBeUndefined();
    expect(ESSENTIALS.map((t) => pick(t.id, [section("Radio")]))).toEqual(
      ESSENTIALS.map(() => undefined),
    );
  });

  it("fills whole rows: 8, 6 or 4 tiles, never fewer than 4 when available", () => {
    expect([13, 8, 7, 6, 5, 4, 3].map(essentialsSize)).toEqual([
      8, 8, 6, 6, 4, 4, 4,
    ]);
    expect(ESSENTIALS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ESSENTIALS.map((t) => t.id)).size).toBe(ESSENTIALS.length);
    for (const t of ESSENTIALS) expect(t.description).toMatch(/\.$/);
  });

  it("recognises technical data chapters", () => {
    expect(TECHNICAL_SECTION.test("Dane techniczne")).toBe(true);
    expect(TECHNICAL_SECTION.test("Kluczyki")).toBe(false);
  });
});

describe("overview helpers", () => {
  it("shortens at a word boundary", () => {
    expect(shorten("krótki tekst", 50)).toBe("krótki tekst");
    expect(shorten("Sprawdzaj ciśnienie w oponach co miesiąc", 25)).toBe(
      "Sprawdzaj ciśnienie w…",
    );
  });

  it("uses large illustrations only as thumbnails", () => {
    expect(firstIllustration([icon("b1")])).toBeNull();
    const big: Block = {
      type: "image",
      id: "b2",
      src: "/media/x.webp",
      width: 400,
      height: 300,
      alt: "",
    };
    expect(firstIllustration([icon("b1"), big])).toBe(big);
  });

  it("reads two-column tables as label/value facts", () => {
    expect(
      tableFacts({
        type: "table",
        id: "b1",
        header: true,
        rows: [
          ["Płyn", "Pojemność"],
          ["Olej silnikowy", "4,5 l"],
          ["", "x"],
        ],
      }),
    ).toEqual([{ label: "Olej silnikowy", value: "4,5 l" }]);
    expect(
      tableFacts({
        type: "table",
        id: "b2",
        header: false,
        rows: [["a", "b", "c"]],
      }),
    ).toBeNull();
    expect(isNumeric("4,5 l")).toBe(true);
    expect(isNumeric("patrz tabela")).toBe(false);
  });

  it("describes the engine in Polish units", () => {
    expect(kwToHp(125)).toBe(170);
    expect(
      specParts({
        fuel: "petrol",
        engineCm3: 1598,
        powerKw: 125,
        label: "",
      }),
    ).toEqual(["1,6 l", "125 kW (170 KM)", "benzyna"]);
    expect(
      specParts({ fuel: "electric", engineCm3: null, powerKw: 100, label: "" }),
    ).toEqual(["100 kW (136 KM)", "elektryczny"]);
  });
});

describe("technical data detection", () => {
  it("recognises measured values", () => {
    expect(hasMeasurement("4,5 l")).toBe(true);
    expect(hasMeasurement("2,3 bar (230 kPa)")).toBe(true);
    expect(hasMeasurement("1 350 kg")).toBe(true);
    expect(hasMeasurement("H7 55 W")).toBe(true);
    expect(hasMeasurement("str. 12")).toBe(false);
    expect(hasMeasurement("2 lata")).toBe(false);
  });

  it("accepts tables whose rows mostly carry measurements", () => {
    const table = (rows: string[][]): Block => ({
      type: "table",
      id: "b1",
      header: true,
      rows,
    });
    const bulbs = table([
      ["Światło", "Moc"],
      ["Mijania", "55 W"],
      ["Pozycyjne", "5 W"],
    ]);
    const plain = table([
      ["Przycisk", "Funkcja"],
      ["A", "Radio"],
      ["B", "Nawigacja"],
    ]);
    expect(bulbs.type === "table" && isMeasurementTable(bulbs)).toBe(true);
    expect(plain.type === "table" && isMeasurementTable(plain)).toBe(false);
  });

  it("reads label: value lines printed as text", () => {
    const blocks: Block[] = [
      { type: "paragraph", id: "b1", runs: ["Pojemność zbiornika: 52 l"] },
      {
        type: "list",
        id: "b2",
        ordered: false,
        items: [["Olej silnikowy: 4,0 l"], ["Uwaga: patrz str. 3"]],
      },
      { type: "paragraph", id: "b3", runs: ["Ciśnienie: 2,3 bar"] },
    ];
    expect(textFacts(blocks)).toEqual([
      {
        id: "b1",
        facts: [
          { label: "Pojemność zbiornika", value: "52 l" },
          { label: "Olej silnikowy", value: "4,0 l" },
        ],
      },
    ]);
  });
});
