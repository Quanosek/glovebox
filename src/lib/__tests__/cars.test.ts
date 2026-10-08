import { describe, expect, it } from "vitest";
import type { CarSummary } from "@/lib/cars";
import { hasReadableManual } from "@/lib/cars";

const car = (placeholder: boolean): CarSummary => ({
  id: "vehicle-1",
  brand: "Marka",
  model: "Model",
  year: 2024,
  label: "Marka Model 2024",
  href: "/auto/vehicle-1",
  books: [
    {
      id: "book",
      route: "manual",
      title: "Instrukcja",
      short: "Instrukcja",
      href: "/auto/vehicle-1/manual",
      sections: 1,
      pages: 1,
      placeholder,
    },
  ],
});

describe("hasReadableManual", () => {
  it("returns false when there are no cars or only placeholder books", () => {
    expect(hasReadableManual([])).toBe(false);
    expect(hasReadableManual([car(true)])).toBe(false);
  });

  it("returns true when a car has at least one usable manual", () => {
    expect(hasReadableManual([car(false)])).toBe(true);
  });
});
