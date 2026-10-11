import { describe, expect, it } from "vitest";
import {
  logoCandidates,
  parseLogoClaims,
  pickLogo,
  type BrandLogo,
} from "@/lib/logos";

const claim = (file: string, rank: string, start?: number, end?: number) => ({
  rank,
  mainsnak: { datavalue: { value: file } },
  qualifiers: {
    ...(start && {
      P580: [{ datavalue: { value: { time: `+${start}-00-00T00:00:00Z` } } }],
    }),
    ...(end && {
      P582: [{ datavalue: { value: { time: `+${end}-00-00T00:00:00Z` } } }],
    }),
  },
});

// Opel (Q40966) as published on Wikidata: former logos are "deprecated".
const OPEL = parseLogoClaims({
  claims: {
    P154: [
      claim("Opel Logo 2021.svg", "deprecated", 2021, 2023),
      claim("Opel Print 1970.svg", "deprecated"),
      claim("Opel logo.svg", "deprecated", 2009, 2017),
      claim("Opel-Logo 2017.svg", "deprecated", 2017, 2021),
      claim("Opel logo 2023.svg", "preferred", 2023),
    ],
  },
});

const pick = (logos: BrandLogo[], year: number) => pickLogo(logos, year)?.file;

describe("parseLogoClaims", () => {
  it("reads files, ranks and years", () => {
    expect(OPEL).toHaveLength(5);
    expect(OPEL[2]).toEqual({
      file: "Opel logo.svg",
      rank: "deprecated",
      start: 2009,
      end: 2017,
    });
    expect(OPEL[1].start).toBeUndefined();
  });

  it("ignores broken input", () => {
    expect(parseLogoClaims(null)).toEqual([]);
    expect(parseLogoClaims({ claims: { P154: [{ mainsnak: {} }] } })).toEqual(
      [],
    );
  });

  it("dates logos known only from a point in time (P585) to that year", () => {
    const point = (file: string, year: number) => ({
      rank: "deprecated",
      mainsnak: { datavalue: { value: file } },
      qualifiers: {
        P585: [{ datavalue: { value: { time: `+${year}-00-00T00:00:00Z` } } }],
      },
    });
    // Opel as currently published: the 1970 and 1987 logos carry P585.
    const opel = parseLogoClaims({
      claims: {
        P154: [
          point("Opel Print 1970.svg", 1970),
          point("Opel Logo 1987.svg", 1987),
          claim("Opel logo.svg", "deprecated", 2009, 2017),
          claim("Opel-Logo 2017.svg", "deprecated", 2017, 2021),
          claim("Opel logo 2023.svg", "preferred", 2023),
        ],
      },
    });
    expect(opel[1]).toMatchObject({ start: 1987, end: 1987 });
    expect(pick(opel, 1972)).toBe("Opel Print 1970.svg");
    expect(pick(opel, 1995)).toBe("Opel Logo 1987.svg");
    expect(pick(opel, 2016)).toBe("Opel logo.svg");
    expect(pick(opel, 2025)).toBe("Opel logo 2023.svg");
    // A point-in-time logo never displaces the current undated one.
    const brand = parseLogoClaims({
      claims: {
        P154: [point("Old.svg", 1987), claim("Current.svg", "normal")],
      },
    });
    expect(pick(brand, 2022)).toBe("Current.svg");
  });
});

describe("pickLogo", () => {
  it("uses the logo of the model year", () => {
    expect(pick(OPEL, 2016)).toBe("Opel logo.svg");
    expect(pick(OPEL, 2019)).toBe("Opel-Logo 2017.svg");
    expect(pick(OPEL, 2026)).toBe("Opel logo 2023.svg");
  });

  it("takes the new logo in the year of a change", () => {
    expect(pick(OPEL, 2017)).toBe("Opel-Logo 2017.svg");
  });

  it("uses the oldest known logo for older cars, never an undated deprecated one", () => {
    expect(pick(OPEL, 1980)).toBe("Opel logo.svg");
    expect(pick(OPEL, 2005)).toBe("Opel logo.svg");
  });

  it("uses the nearest period for a year between logos", () => {
    const logos: BrandLogo[] = [
      { file: "A.svg", rank: "normal", start: 1990, end: 1999 },
      { file: "B.svg", rank: "normal", start: 2005, end: 2015 },
    ];
    expect(pick(logos, 2001)).toBe("A.svg");
    expect(pick(logos, 2003)).toBe("B.svg");
    expect(pick(logos, 2002)).toBe("B.svg");
    expect(pick(logos, 2020)).toBe("B.svg");
  });

  it("prefers a covering dated logo over an undated one", () => {
    const logos: BrandLogo[] = [
      { file: "Kia now.svg", rank: "preferred" },
      { file: "Kia 2012.svg", rank: "normal", start: 2012, end: 2021 },
    ];
    expect(pick(logos, 2016)).toBe("Kia 2012.svg");
    expect(pick(logos, 2023)).toBe("Kia now.svg");
    // Older than every dated logo: the dated one is closer than today's.
    expect(pick(logos, 2005)).toBe("Kia 2012.svg");
  });

  it("prefers drawings over photos of the same period", () => {
    const peugeot: BrandLogo[] = [
      { file: "Wordmark Peugeot 2021.svg", rank: "normal" },
      { file: "2021 - Peugeot 308 III (C) - 42.jpg", rank: "preferred" },
    ];
    expect(pick(peugeot, 2016)).toBe("Wordmark Peugeot 2021.svg");
    // A dated JPEG is still the logo of its years.
    const dacia: BrandLogo[] = [
      { file: "Dacia 2021 logo green.svg", rank: "preferred", start: 2021 },
      { file: "Dacia Logo new.jpg", rank: "normal", start: 2008, end: 2021 },
    ];
    expect(pick(dacia, 2016)).toBe("Dacia Logo new.jpg");
  });

  it("returns undefined without logos", () => {
    expect(pickLogo([], 2016)).toBeUndefined();
  });
});

describe("logoCandidates", () => {
  it("keeps car companies named like the brand, current ones first", () => {
    const hits = [
      { id: "Q1", label: "Opel Astra", description: "compact car model" },
      {
        id: "Q2",
        label: "MG Car Company",
        description: "former British car company",
      },
      { id: "Q3", label: "MG Motor", description: "British automotive marque" },
      { id: "Q4", label: "MG", description: "Wikimedia disambiguation page" },
      {
        id: "Q5",
        label: "Morris Garages",
        description: "car brand",
        match: { text: "MG" },
      },
    ];
    expect(logoCandidates(hits, "MG")).toEqual(["Q3", "Q5", "Q2"]);
  });

  it("matches names without diacritics and punctuation", () => {
    const hits = [
      {
        id: "Q29637",
        label: "Škoda Auto",
        description: "automotive manufacturer",
      },
    ];
    expect(logoCandidates(hits, "Skoda")).toEqual(["Q29637"]);
    expect(logoCandidates(hits, "")).toEqual([]);
  });
});
