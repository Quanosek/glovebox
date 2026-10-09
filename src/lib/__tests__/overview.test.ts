import { describe, expect, it } from "vitest";
import {
  INDICATOR_SECTION,
  QUICK_TOPICS,
  QUICK_TOPICS_MAX,
  TECHNICAL_SECTION,
  matchQuickTopics,
} from "@/config/quickTopics";
import type { Block } from "@/content/types";
import {
  firstIllustration,
  iconEntries,
  isNumeric,
  kwToHp,
  shorten,
  specParts,
  tableFacts,
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
const para = (id: string, text: string): Block => ({
  type: "paragraph",
  id,
  runs: [text],
});

describe("quick topics", () => {
  it("finds the usual owner topics by section title", () => {
    expect(matchQuickTopics("Ciśnienie w oponach")).toContain("tyres");
    expect(matchQuickTopics("Zmiana koła")).toContain("wheel");
    expect(matchQuickTopics("Bezpieczniki w komorze silnika")).toContain(
      "fuses",
    );
    expect(matchQuickTopics("Wymiana żarówek")).toContain("bulbs");
    expect(matchQuickTopics("Olej silnikowy")).toContain("fluids");
    expect(matchQuickTopics("Tankowanie")).toContain("fuel");
    expect(matchQuickTopics("Lampki kontrolne")).toContain("indicators");
  });

  it("skips misleading titles", () => {
    expect(matchQuickTopics("Lampki kontrolne")).not.toContain("bulbs");
    expect(matchQuickTopics("Wskaźnik poziomu paliwa")).not.toContain("fuel");
    expect(matchQuickTopics("Radio")).toEqual([]);
  });

  it("keeps the tile limit within the Navi-like grid", () => {
    expect(QUICK_TOPICS_MAX).toBeLessThanOrEqual(8);
    expect(new Set(QUICK_TOPICS.map((t) => t.id)).size).toBe(
      QUICK_TOPICS.length,
    );
  });

  it("recognises indicator and technical data chapters", () => {
    expect(INDICATOR_SECTION.test("Lampki kontrolne")).toBe(true);
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

  it("pairs pictograms with the text that follows them", () => {
    const entries = iconEntries([
      icon("b1"),
      icon("b2"),
      para("b3", "Lampka ciśnienia oleju"),
      icon("b4"),
      { type: "table", id: "b5", header: false, rows: [["a", "b"]] },
    ]);
    expect(entries.map((e) => [e.id, e.text])).toEqual([
      ["b1", "Lampka ciśnienia oleju"],
      ["b2", "Lampka ciśnienia oleju"],
    ]);
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
