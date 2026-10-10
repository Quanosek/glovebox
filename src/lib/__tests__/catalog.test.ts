import { describe, expect, it } from "vitest";
import {
  brandKey,
  brandName,
  createBrandResolver,
  editDistance,
  engineId,
  engineLabel,
  fixMojibake,
  fuelKind,
  includeUpcomingModelYears,
  isTypoOf,
  modelFamily,
} from "@/lib/catalog";

describe("brandKey", () => {
  it("normalises spellings and aliases", () => {
    expect(brandKey("VOLKSWAGEN, VW")).toBe("VOLKSWAGEN");
    expect(brandKey("VW")).toBe("VOLKSWAGEN");
    expect(brandKey("FORD (D)")).toBe("FORD");
    expect(brandKey("Mercedes-Benz")).toBe("MERCEDESBENZ");
    expect(brandKey("ŠKODA")).toBe("SKODA");
  });

  it("rejects placeholders and group names", () => {
    expect(brandKey("UNKNOWN")).toBeNull();
    expect(brandKey("124")).toBeNull();
    expect(brandKey("JAGUAR LAND ROVER LIMITED")).toBeNull();
    expect(brandKey(null)).toBeNull();
  });
});

describe("fixMojibake", () => {
  it("repairs UTF-8 read as Windows-1252", () => {
    expect(fixMojibake("CitroÃ«n")).toBe("Citroën");
    expect(fixMojibake("CITROÃ‹N")).toBe("CITROËN");
    expect(fixMojibake("Škoda")).toBe("Škoda");
  });
});

describe("typos", () => {
  it("measures small edit distances", () => {
    expect(editDistance("INSIGNIA", "INSIGINIA")).toBe(1);
    expect(editDistance("CITROEN", "CITOREN")).toBe(1);
    expect(editDistance("GOLF", "POLO")).toBe(2);
  });

  it("keeps different numbers apart", () => {
    expect(isTypoOf("AFIRA", "ZAFIRA")).toBe(true);
    expect(isTypoOf("Q3", "Q5")).toBe(false);
    expect(isTypoOf("I20", "I30")).toBe(false);
    expect(isTypoOf("CX30", "CX3")).toBe(false);
  });
});

describe("createBrandResolver", () => {
  const strong = new Set([
    "FORD",
    "SKODA",
    "CODA",
    "FIAT",
    "OPEL",
    "VAUXHALL",
    "AUDI",
    "BMW",
    "MINI",
    "ALFAROMEO",
    "LYNKCO",
  ]);
  const weights: Record<string, number> = { SKODA: 8_000_000, CODA: 0 };
  const resolve = createBrandResolver(strong, (k) => weights[k] ?? 0);

  it("maps company names and typos onto known brands", () => {
    expect(resolve("Ford Werke Gmbh")).toBe("FORD");
    expect(resolve("Audi AG D-85045 Ingolstadt")).toBe("AUDI");
    expect(resolve("FIAT - INNOCENTI")).toBe("FIAT");
    expect(resolve("?KODA")).toBe("SKODA");
    expect(resolve("OPELVAUXHALL")).toBe("OPEL");
    expect(resolve("OPEL, VAUXHALL")).toBe("OPEL");
    expect(resolve("Alfa")).toBe("ALFAROMEO");
    expect(resolve("LYNK & CO")).toBe("LYNKCO");
  });

  it("drops rows that mix two brands", () => {
    expect(resolve("BMW,MINI")).toBeNull();
  });

  it("keeps unknown but plausible brands", () => {
    expect(resolve("Leapmotor")).toBe("LEAPMOTOR");
  });
});

describe("brandName", () => {
  it("prefers curated and exact spellings", () => {
    expect(brandName("SKODA", ["SKODA"])).toBe("Škoda");
    expect(brandName("BMW", ["BMW i", "BMW"])).toBe("BMW");
    expect(brandName("LEAPMOTOR", ["LEAPMOTOR"])).toBe("Leapmotor");
  });
});

describe("modelFamily", () => {
  const fam = (brand: string, raw: string, others: string[] = []) =>
    modelFamily(brand, raw, [], new Set(others));

  it("cuts engine and trim data", () => {
    expect(fam("OPEL", "CASCADA / CABRIO 1.6 / TURBO")?.name).toBe("CASCADA");
    expect(fam("TOYOTA", "TOYOTA YARIS HYBRID")?.key).toBe("YARIS");
    expect(fam("VOLKSWAGEN", "ID.3PRO150KW")?.key).toBe("ID3PRO");
    expect(fam("TOYOTA", "Toyotaauris 1.6")?.key).toBe("AURIS");
  });

  it("joins short names written with a space", () => {
    expect(fam("TOYOTA", "RAV 4 HYBRID")?.key).toBe("RAV4");
    expect(fam("TOYOTA", "C HR")?.name).toBe("C-HR");
    expect(fam("VOLKSWAGEN", "ID. 3")?.name).toBe("ID.3");
    expect(fam("VOLKSWAGEN", "UP GTI")?.key).toBe("UP");
  });

  it("keeps two-word names together", () => {
    expect(fam("TESLA", "MODEL 3")?.name).toBe("MODEL 3");
    expect(fam("LANDROVER", "RANGE ROVER EVOQUE")?.key).toBe(
      "RANGEROVEREVOQUE",
    );
    expect(fam("TOYOTA", "LAND 2.8")).toBeNull();
  });

  it("rejects placeholders, trims and other brands", () => {
    expect(fam("FORD", "UNKNOWN")).toBeNull();
    expect(fam("FORD", "TITANIUM")).toBeNull();
    expect(fam("TOYOTA", "LEXUS NX300H", ["LEXUS"])).toBeNull();
  });

  it("groups BMW models into series", () => {
    expect(fam("BMW", "320d xDrive")?.name).toBe("Seria 3");
    expect(fam("BMW", "M1 35I XDRIVE")?.name).toBe("Seria 1");
    expect(fam("BMW", "M135I XDRIVE")?.name).toBe("Seria 1");
    expect(fam("BMW", "iX3")?.name).toBe("iX3");
    expect(fam("BMW", "X8 M")?.name).toBe("XM");
    expect(fam("BMW", "I20 DYN AWD")).toBeNull();
  });

  it("groups Mercedes-Benz models into classes", () => {
    expect(fam("MERCEDESBENZ", "C 220 d")?.name).toBe("Klasa C");
    expect(fam("MERCEDESBENZ", "A-KLASSE")?.name).toBe("Klasa A");
    expect(fam("MERCEDESBENZ", "ML 350")?.name).toBe("Klasa M");
    expect(fam("MERCEDESBENZ", "AMG GT 63")?.name).toBe("AMG GT");
    expect(fam("MERCEDESBENZ", "AMGGLC 43")?.key).toBe("GLC");
    expect(fam("MERCEDESBENZ", "GLC 300")?.key).toBe("GLC");
  });
});

describe("engines", () => {
  it("classifies fuel types", () => {
    expect(fuelKind("PETROL", "M")).toBe("petrol");
    expect(fuelKind("diesel", "M")).toBe("diesel");
    expect(fuelKind("PETROL/ELECTRIC", "P")).toBe("plugin-petrol");
    expect(fuelKind("PETROL", "H")).toBe("hybrid-petrol");
    expect(fuelKind("LPG", "B")).toBe("lpg");
    expect(fuelKind("ELECTRIC", "E")).toBe("electric");
  });

  describe("includeUpcomingModelYears", () => {
    it("adds current and next model years for recently registered models", () => {
      expect(includeUpcomingModelYears([2023, 2024, 2025], 2026)).toEqual([
        2023, 2024, 2025, 2026, 2027,
      ]);
    });

    it("does not extend discontinued models or duplicate existing years", () => {
      expect(includeUpcomingModelYears([2019, 2020], 2026)).toEqual([
        2019, 2020,
      ]);
      expect(includeUpcomingModelYears([2025, 2026, 2027], 2026)).toEqual([
        2025, 2026, 2027,
      ]);
    });
  });

  it("builds Polish labels and stable ids", () => {
    expect(engineLabel("petrol", 1600, 125)).toBe(
      "1,6 benzyna · 125 kW (170 KM)",
    );
    expect(engineId("petrol", 1600, 125)).toBe("petrol-1600-125");
    expect(engineId("electric", null, 150)).toBe("electric-0-150");
  });
});
