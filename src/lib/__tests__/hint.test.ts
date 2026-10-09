import { describe, expect, it } from "vitest";
import {
  EMPTY_HINT,
  buildHint,
  parseHint,
  serializeHint,
} from "@/lib/storage/hint";
import { createEmptyData } from "@/lib/storage/schema";

const car = "opel-astra-2018";

describe("layout hint", () => {
  it("round-trips through the cookie value", () => {
    const data = createEmptyData();
    data.settings.ownedCars = [car];
    data.settings.activeCar = car;
    data.settings.profileName = " Jan ";
    data.settings.fontSize = "large";
    data.notebook.pages = [
      { id: "p", title: "", body: "", createdAt: "x", updatedAt: "x" },
    ];
    data.lastRead = {
      car,
      book: "manual",
      sectionId: "a",
      title: "Ciśnienie w oponach – 100% ważne",
      href: `/auto/${car}/manual/a`,
      scrollY: 0,
      at: "2026-10-09T10:00:00.000Z",
    };
    data.reminders = [
      {
        id: `inspection:${car}`,
        car,
        kind: "inspection",
        title: "Badanie techniczne",
        dueDate: "2026-10-20",
        dueKm: null,
        done: false,
        createdAt: "x",
        updatedAt: "x",
      },
    ];
    const hint = buildHint(data, [car, "not-owned"], "2026-10-09");
    expect(hint.name).toBe("Jan");
    expect(hint.counts).toEqual([0, 0, 0, 1]);
    expect(hint.offline).toEqual([car]);
    expect(hint.due).toBe(1);
    const value = serializeHint(hint);
    expect(parseHint(value)).toEqual(hint);
    // Next.js may hand over an already decoded value.
    expect(parseHint(decodeURIComponent(value))).toEqual(hint);
  });

  it("drops invalid or foreign values", () => {
    expect(parseHint(undefined)).toEqual(EMPTY_HINT);
    expect(parseHint("%E0%A4%A")).toEqual(EMPTY_HINT);
    const hint = parseHint(
      JSON.stringify({
        activeCar: "../etc",
        ownedCars: [car, "Bad Id", car],
        fontSize: "huge",
        counts: [-1, 2.4, "x"],
        lastRead: {
          car,
          title: "A",
          href: "https://example.com",
          when: "",
        },
        marks: [true, "yes", false],
        favorites: { [car]: 99, "../x": 1 },
        due: 5,
      }),
    );
    expect(hint).toMatchObject({
      activeCar: null,
      ownedCars: [car],
      fontSize: "normal",
      counts: [0, 2, 0, 0],
      lastRead: null,
      marks: [true, false, false],
      favorites: { [car]: 6 },
      due: 5,
    });
  });
});
