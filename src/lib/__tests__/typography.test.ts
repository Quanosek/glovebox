import { describe, expect, it } from "vitest";
import { resolve } from "@/lib/anchoring/textQuote";
import { NBSP, plural, polishTypography } from "@/lib/typography";

const t = (s: string) => s.replace(/~/g, NBSP);

describe("polishTypography", () => {
  it("keeps one-letter words with the next word", () => {
    expect(polishTypography("Kluczyk w stacyjce i pilot")).toBe(
      t("Kluczyk w~stacyjce i~pilot"),
    );
    expect(polishTypography("A potem z boku")).toBe(t("A~potem z~boku"));
  });

  it("handles chains of one-letter words and brackets", () => {
    expect(polishTypography("tak a w razie (i z kluczem)")).toBe(
      t("tak a~w~razie (i~z~kluczem)"),
    );
  });

  it("binds a one-letter word that ends a text run", () => {
    expect(polishTypography("Zobacz w ")).toBe(t("Zobacz w~"));
  });

  it("does not touch letters inside words", () => {
    expect(polishTypography("Opel Cascada")).toBe("Opel Cascada");
    expect(polishTypography("radio z")).toBe("radio z");
  });

  it("binds abbreviations, numbers with units and digit groups", () => {
    expect(polishTypography("np. dach, m.in. fotele")).toBe(
      t("np.~dach, m.in.~fotele"),
    );
    expect(polishTypography("silnik 125 kW przy 1 500 obr/min")).toBe(
      t("silnik 125~kW przy 1~500~obr/min"),
    );
    expect(polishTypography("zob. str. 12")).toBe(t("zob.~str.~12"));
    expect(polishTypography("ok. 20 °C")).toBe(t("ok.~20~°C"));
    expect(polishTypography("lusterka, fotele itd.")).toBe(
      t("lusterka, fotele~itd."),
    );
  });

  it("keeps a dash with the preceding word", () => {
    expect(polishTypography("Radio – opis")).toBe(t("Radio~– opis"));
  });

  it("does not bind long numbers to long words", () => {
    expect(polishTypography("2 fotele")).toBe("2 fotele");
  });

  it("binds a short last word of a paragraph when asked", () => {
    expect(
      polishTypography("Dach otwiera się dźwignią", { lastWord: true }),
    ).toBe(t("Dach otwiera się~dźwignią"));
    expect(polishTypography("Dwa słowa", { lastWord: true })).toBe("Dwa słowa");
    expect(polishTypography("Jedno", { lastWord: true })).toBe("Jedno");
    expect(
      polishTypography("Krótko i bardzodługiesłowoponadlimit", {
        lastWord: true,
      }),
    ).toBe(t("Krótko i~bardzodługiesłowoponadlimit"));
  });

  it("keeps the length and is idempotent", () => {
    const input = "W razie awarii z kołem użyj zestawu – np. 5 l, ok. 1 000 m";
    const once = polishTypography(input, { lastWord: true });
    expect(once).toHaveLength(input.length);
    expect(polishTypography(once, { lastWord: true })).toBe(once);
  });

  it("does not break highlights stored before the change", () => {
    const before = "Kluczyk w stacyjce i pilot z trzema przyciskami";
    const after = polishTypography(before);
    const anchor = {
      exact: "w stacyjce i pilot",
      prefix: "Kluczyk ",
      suffix: " z trzema",
      start: 8,
      end: 26,
    };
    expect(resolve(after, anchor)).toEqual({ start: 8, end: 26 });
  });
});

describe("plural", () => {
  it("picks the Polish plural form", () => {
    const f = (n: number) => plural(n, "plik", "pliki", "plików");
    expect([0, 1, 2, 4, 5, 12, 14, 22, 25, 112, 123].map(f)).toEqual([
      "plików",
      "plik",
      "pliki",
      "pliki",
      "plików",
      "plików",
      "plików",
      "pliki",
      "plików",
      "plików",
      "pliki",
    ]);
  });
});
