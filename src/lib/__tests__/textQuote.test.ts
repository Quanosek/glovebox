import { describe as suite, expect, it } from "vitest";
import { describe, normalizeWithMap, resolve } from "@/lib/anchoring/textQuote";

const TEXT =
  "Nacisnąć przycisk, aby odblokować. Nacisnąć przycisk ponownie, aby zablokować wszystkie drzwi.";

suite("textQuote.describe", () => {
  it("captures exact text, context and offsets", () => {
    const start = TEXT.indexOf("ponownie");
    const a = describe(TEXT, start, start + "ponownie".length);
    expect(a.exact).toBe("ponownie");
    expect(a.start).toBe(start);
    expect(a.end).toBe(start + 8);
    expect(TEXT.endsWith(a.suffix) || TEXT.includes(a.prefix + a.exact + a.suffix)).toBe(true);
  });

  it("normalises reversed and out-of-bounds offsets", () => {
    const a = describe("abc", 5, -1);
    expect(a).toMatchObject({ exact: "abc", start: 0, end: 3 });
  });
});

suite("textQuote.resolve", () => {
  it("uses the stored position when text is unchanged", () => {
    const start = TEXT.indexOf("zablokować");
    const a = describe(TEXT, start, start + 10);
    expect(resolve(TEXT, a)).toEqual({ start, end: start + 10 });
  });

  it("disambiguates repeated quotes by context after text moved", () => {
    const second = TEXT.indexOf("Nacisnąć", 5);
    const a = describe(TEXT, second, second + "Nacisnąć przycisk".length);
    const changed = "NOWY WSTĘP. " + TEXT;
    const r = resolve(changed, a)!;
    expect(r.start).toBe(second + "NOWY WSTĘP. ".length);
    expect(changed.slice(r.start, r.end)).toBe("Nacisnąć przycisk");
  });

  it("falls back to whitespace-insensitive matching", () => {
    const start = TEXT.indexOf("wszystkie drzwi");
    const a = describe(TEXT, start, start + "wszystkie drzwi".length);
    const changed = TEXT.replace("wszystkie drzwi", "wszystkie \n  drzwi");
    const r = resolve(changed, a)!;
    expect(changed.slice(r.start, r.end)).toBe("wszystkie \n  drzwi");
  });

  it("returns null when the quote no longer exists", () => {
    const a = describe(TEXT, 0, 8);
    expect(resolve("Zupełnie inny tekst", a)).toBeNull();
  });
});

suite("normalizeWithMap", () => {
  it("maps collapsed whitespace back to original indices", () => {
    const { normalized, map } = normalizeWithMap("a  b\n\nc");
    expect(normalized).toBe("a b c");
    expect(map).toEqual([0, 1, 3, 4, 6]);
  });
});
