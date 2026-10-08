import { describe, expect, it } from "vitest";
import { isValidId, slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("transliterates Polish characters", () => {
    expect(slugify("Łódź – Żółć Ślęża")).toBe("lodz-zolc-sleza");
  });

  it("builds car ids", () => {
    expect(slugify("Opel Cascada 2016")).toBe("opel-cascada-2016");
    expect(slugify("Mercedes-Benz  Klasa C (W205)")).toBe(
      "mercedes-benz-klasa-c-w205",
    );
  });

  it("returns an empty string for symbols only", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("respects the maximum length without a trailing dash", () => {
    expect(slugify("aaaa bbbb", 5)).toBe("aaaa");
  });
});

describe("uniqueSlug / isValidId", () => {
  it("appends a counter when taken", () => {
    expect(uniqueSlug("a", ["a", "a-2"])).toBe("a-3");
    expect(uniqueSlug("b", ["a"])).toBe("b");
  });

  it("rejects path traversal and uppercase", () => {
    expect(isValidId("opel-cascada-2016")).toBe(true);
    expect(isValidId("../x")).toBe(false);
    expect(isValidId("Opel")).toBe(false);
    expect(isValidId(".import-1")).toBe(false);
    expect(isValidId("")).toBe(false);
  });
});
