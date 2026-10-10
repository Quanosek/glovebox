import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TechPreview } from "@/components/car/TechPreview";
import type { TableBlock } from "@/content/types";
import type { CarSpec } from "@/lib/catalog";
import {
  enginesFromTables,
  engineChoices,
  engineChoiceLabel,
  engineTableSelection,
  matchingEngineCodes,
  sanitizeEngine,
  vehicleProfileWithEngine,
} from "@/lib/engines";
import { driverFacts } from "@/lib/driverFacts";
import type { TechCard } from "@/lib/overview";

const petrol: CarSpec = {
  code: "P16",
  fuel: "petrol",
  powerKw: 125,
  engineCm3: 1598,
  label: "1.6 Turbo · P16",
};
const diesel: CarSpec = {
  code: "D20",
  fuel: "diesel",
  powerKw: 125,
  engineCm3: 1956,
  label: "2.0 Diesel · D20",
};
const engines = [petrol, diesel];
const table = (rows: string[][], header = true): TableBlock => ({
  type: "table",
  id: "b1",
  header,
  rows,
});
const specs = table([
  ["Oznaczenie handlowe", "1.6 Turbo", "2.0 Diesel"],
  ["Oznaczenie kodowe typu silnika", "P16", "D20"],
  ["Pojemność skokowa [cm³]", "1598", "1956"],
  ["Moc silnika [kW]", "125", "125"],
  ["Rodzaj paliwa", "Benzyna", "Olej napędowy"],
]);
const card = (
  title: string,
  facts: { label: string; value: string }[],
): TechCard => ({
  section: "Dane techniczne",
  book: "Instrukcja",
  href: "/manual",
  tables: [{ kind: "facts", id: "b1", href: "/manual#b1", title, facts }],
});

describe("manual engine variants", () => {
  it("groups petrol before diesel and sorts by capacity then kW", () => {
    const choices = engineChoices([
      diesel,
      { ...petrol, powerKw: 147 },
      { ...petrol, powerKw: 88, engineCm3: 1364 },
      petrol,
      { ...diesel, powerKw: 121 },
    ]);
    expect(choices.map((e) => [e.fuel, e.engineCm3, e.powerKw])).toEqual([
      ["petrol", 1400, 88],
      ["petrol", 1600, 125],
      ["petrol", 1600, 147],
      ["diesel", 2000, 121],
      ["diesel", 2000, 125],
    ]);
    expect(engineChoiceLabel(petrol)).toBe("1,6 l · 170 KM (125 kW)");
  });
  it("merges duplicate specifications and does not display or arbitrarily pick their codes", () => {
    const [choice] = engineChoices([petrol, { ...petrol, code: "P16B" }]);
    expect(choice.code).toBeUndefined();
    expect(choice.label).toBe("1,6 l · 170 KM (125 kW)");
    expect(
      matchingEngineCodes(choice, [petrol, { ...petrol, code: "P16B" }]),
    ).toEqual(["P16", "P16B"]);
  });
  it("reads manufacturer codes, exact displacement, power and fuel", () => {
    expect(enginesFromTables([specs])).toEqual([
      { ...petrol, label: "1.6 Turbo · 125 kW · P16" },
      { ...diesel, label: "2.0 Diesel · 125 kW · D20" },
    ]);
  });
  it("joins specifications split across pages by engine code", () => {
    const first = table(specs.rows.slice(0, 4));
    const second = table([specs.rows[1], specs.rows[4]]);
    expect(enginesFromTables([first, second])).toHaveLength(2);
  });
  it("does not infer fuel from an engine name or power alone", () => {
    expect(enginesFromTables([table(specs.rows.slice(0, 4))])).toEqual([]);
  });
  it("rejects contradictory specifications for the same manufacturer code", () => {
    const changed = table(
      specs.rows.map((row) =>
        row[0] === "Moc silnika [kW]" ? [row[0], "147", "125"] : row,
      ),
    );
    expect(enginesFromTables([specs, changed]).map((e) => e.code)).toEqual([
      "D20",
    ]);
  });
  it("does not confuse LPG or hybrid fuel descriptions with ordinary petrol", () => {
    const changed = table(
      specs.rows.map((row) =>
        row[0] === "Rodzaj paliwa"
          ? [row[0], "Benzyna + LPG", "Hybryda diesel-elektryczna"]
          : row,
      ),
    );
    expect(enginesFromTables([changed]).map((e) => e.fuel)).toEqual(["lpg"]);
  });
  it("matches rounded catalogue displacement without matching another fuel", () => {
    expect(
      matchingEngineCodes(
        { ...diesel, code: undefined, engineCm3: 2000 },
        engines,
      ),
    ).toEqual(["D20"]);
  });
  it("keeps all candidates when catalogue parameters cannot distinguish variants", () => {
    expect(
      matchingEngineCodes({ ...petrol, code: undefined, engineCm3: 1600 }, [
        petrol,
        { ...petrol, code: "P16B" },
      ]),
    ).toEqual(["P16", "P16B"]);
  });
  it("sanitizes engine choices and rejects invalid numbers or fuels", () => {
    expect(sanitizeEngine({ ...diesel, code: "d20" })).toEqual(diesel);
    expect(sanitizeEngine({ ...diesel, powerKw: NaN })).toBeNull();
    expect(sanitizeEngine({ ...diesel, fuel: "invented" })).toBeNull();
    expect(sanitizeEngine({ ...diesel, engineCm3: -1 })).toBeNull();
    expect(sanitizeEngine({ ...diesel, label: "" })).toBeNull();
  });
});

describe("engine table selection", () => {
  it("selects columns but preserves original row indices", () => {
    expect(engineTableSelection(specs, diesel, engines)).toEqual({
      columns: [0, 2],
      rows: [0, 1, 2, 3, 4],
    });
  });
  it("selects groups of engine codes separated by commas", () => {
    expect(
      engineTableSelection(
        table([
          ["Silnik", "P16, P16B", "D20"],
          ["Olej [l]", "5,5", "4,5"],
        ]),
        petrol,
        engines,
      ).columns,
    ).toEqual([0, 1]);
  });
  it("selects engine rows in tyre and weight tables without dropping headings or universal rows", () => {
    const rows = table([
      ["Silnik", "Opony"],
      ["P16", "R18"],
      ["D20", "R17"],
      ["Wszystkie", "R16"],
    ]);
    expect(engineTableSelection(rows, diesel, engines)).toEqual({
      columns: [0, 1],
      rows: [0, 2, 3],
    });
  });
  it("retains whole table when an engine code cannot be found", () => {
    expect(
      engineTableSelection(specs, { ...diesel, code: "UNKNOWN" }, engines)
        .columns,
    ).toEqual([0, 1, 2]);
  });
  it("collapses a known table belonging entirely to other engine variants", () => {
    const petrolOnly = table([
      ["Silnik", "P16"],
      ["Olej [l]", "5,5"],
    ]);
    expect(engineTableSelection(petrolOnly, diesel, engines).rows).toEqual([]);
  });
  it("keeps unknown variants visible rather than assuming they belong to another engine", () => {
    const mixed = table([
      ["Silnik", "P16", "UNKNOWN"],
      ["Olej [l]", "5,5", "6"],
    ]);
    expect(engineTableSelection(mixed, diesel, engines).rows).toEqual([0, 1]);
  });
  it("never matches a substring of a different code", () => {
    expect(
      engineTableSelection(
        table([
          ["Silnik", "P160", "D20"],
          ["Olej [l]", "5", "4"],
        ]),
        petrol,
        engines,
      ).columns,
    ).toEqual([0, 1, 2]);
  });
  it("filters fuel-specific oil columns independently from engine codes", () => {
    const oil = table([
      ["Jakość oleju", "Silniki benzynowe", "Silniki wysokoprężne"],
      ["A", "✔", "–"],
    ]);
    expect(engineTableSelection(oil, diesel, engines).columns).toEqual([0, 2]);
    expect(engineTableSelection(oil, petrol, engines).columns).toEqual([0, 1]);
  });
  it("does not filter combined petrol/diesel columns or unspecified engines", () => {
    const combined = table([
      ["Temperatura", "Silniki benzynowe i wysokoprężne"],
      ["Do -25 °C", "SAE"],
    ]);
    expect(engineTableSelection(combined, diesel, engines).columns).toEqual([
      0, 1,
    ]);
    expect(engineTableSelection(specs, null, engines).columns).toEqual([
      0, 1, 2,
    ]);
  });
});

describe("engine-derived equipment", () => {
  it("replaces stale suggestions when engine changes and preserves owner choices", () => {
    const result = vehicleProfileWithEngine(
      {
        "engine.diesel": { status: "has", certainty: "probable" },
        "drive.towbar": { status: "has", certainty: "confirmed" },
      },
      petrol,
    );
    expect(result["engine.diesel"].status).toBe("no");
    expect(result["drive.towbar"].certainty).toBe("confirmed");
    expect(vehicleProfileWithEngine(result, null)).toEqual({
      "drive.towbar": { status: "has", certainty: "confirmed" },
    });
  });
});

describe("useful driver facts", () => {
  it("renders three model-wide values as three columns, without an engine or an empty fourth cell", () => {
    const cards = [
      card("Zbiornik paliwa", [{ label: "Pojemność [l]", value: "56" }]),
      card("Wymiary", [{ label: "Średnica zawracania [m]", value: "12,2" }]),
      card("Bagażnik", [{ label: "Pojemność bagażnika [l]", value: "350" }]),
    ];
    const html = renderToStaticMarkup(
      createElement(TechPreview, {
        carId: "car",
        cards,
        engines: [],
        tables: 3,
      }),
    );
    expect(html).toContain("grid-cols-3");
    expect(html.match(/<dt\b/g)).toHaveLength(3);
    expect(html).not.toContain("Wybrany silnik");
  });
  it("prioritizes tank capacity instead of early oil-viscosity values and inherits units", () => {
    const cards = [
      card("Olej silnikowy", [
        { label: "Do -25 °C", value: "SAE 5W-30 lub SAE 5W-40" },
      ]),
      card("Zbiornik paliwa", [
        { label: "Ilość do uzupełnienia [l]", value: "46 (wersja ecoFlex) 56" },
      ]),
    ];
    expect(driverFacts(cards, null, engines)).toEqual([
      {
        label: "Zbiornik paliwa",
        value: "46 l (wersja ecoFlex) / 56 l",
        href: "/manual#b1",
      },
    ]);
  });
  it("shows selected engine and fuel, never invents consumption", () => {
    expect(driverFacts([], diesel, engines)).toEqual([
      { label: "Wybrany silnik", value: "2,0 l · 170 KM (125 kW)" },
      { label: "Paliwo", value: "diesel" },
    ]);
  });
  it("does not display engine-dependent two-column facts without an engine choice", () => {
    expect(
      driverFacts(
        [
          card("Silnik", [
            { label: "Moment obrotowy [Nm]", value: "400" },
            { label: "Średnie zużycie paliwa [l/100 km]", value: "6,1" },
          ]),
        ],
        null,
        engines,
      ),
    ).toEqual([]);
  });
  it("preserves conflicting source alternatives and deduplicates identical ones", () => {
    const a = card("Zbiornik paliwa", [
      { label: "Pojemność [l]", value: "56" },
    ]);
    const b = card("Zbiornik paliwa", [
      { label: "Pojemność [l]", value: "60" },
    ]);
    expect(driverFacts([a, a, b], null, engines)[0].value).toBe("56 l / 60 l");
  });
  it("reads selected engine torque and consumption from matching matrices", () => {
    const cards: TechCard[] = [
      {
        section: "Zużycie paliwa",
        book: "Instrukcja",
        href: "/manual",
        tables: [
          {
            kind: "table",
            id: "b2",
            href: "/manual#b2",
            header: true,
            rows: [
              ["Silnik", "P16", "D20"],
              ["Cykl mieszany [l/100 km]", "7,2", "6,1"],
              ["Moment obrotowy [Nm]", "260", "400"],
            ],
          },
        ],
      },
    ];
    const facts = driverFacts(cards, diesel, engines);
    expect(facts.slice(2)).toEqual([
      {
        label: "Zużycie paliwa według instrukcji",
        value: "6,1 l/100 km",
        href: "/manual#b2",
      },
      { label: "Moment obrotowy", value: "400 Nm", href: "/manual#b2" },
    ]);
    expect(driverFacts(cards, null, engines)).toEqual([]);
  });
  it("does not use ambiguous matrices as personal values", () => {
    const cards: TechCard[] = [
      {
        section: "Silnik",
        book: "",
        href: "",
        tables: [
          {
            kind: "table",
            id: "b1",
            href: "",
            header: true,
            rows: [
              ["Silnik", "P16", "P16B"],
              ["Moment obrotowy [Nm]", "260", "280"],
            ],
          },
        ],
      },
    ];
    expect(
      driverFacts(cards, { ...petrol, code: undefined }, [
        petrol,
        { ...petrol, code: "P16B" },
      ]),
    ).toHaveLength(2);
  });
  it("reads a matching single-engine table without using another engine's values", () => {
    const cards: TechCard[] = [
      {
        section: "Silnik",
        book: "",
        href: "",
        tables: [
          {
            kind: "table",
            id: "b1",
            href: "/manual#b1",
            header: true,
            rows: [
              ["Silnik", "D20"],
              ["Moment obrotowy [Nm]", "400"],
            ],
          },
        ],
      },
    ];
    expect(driverFacts(cards, diesel, engines)[2].value).toBe("400 Nm");
    expect(driverFacts(cards, petrol, engines)).toHaveLength(2);
  });
  it("keeps printed units without duplicating them", () => {
    expect(
      driverFacts(
        [card("Zbiornik paliwa", [{ label: "Pojemność [l]", value: "56 l" }])],
        null,
        engines,
      )[0].value,
    ).toBe("56 l");
  });
});
