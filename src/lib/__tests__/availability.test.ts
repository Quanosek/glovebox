import { describe, expect, it } from "vitest";
import { matchFeatures } from "@/config/featureRules";
import {
  FEATURES,
  EXCLUSIVE_FEATURES,
  chooseFeature,
  suggestFromSpec,
  withExclusiveFeatures,
  type VehicleProfile,
} from "@/config/vehicle";
import { getAvailability } from "@/lib/availability";
import type { Block } from "@/content/types";
import type { CarFile } from "@/lib/cars";
import { getFeatureTree, type BookCtx } from "@/lib/content";
import { excerpt, normalizeText } from "@/lib/search";

const PROFILE: VehicleProfile = {
  "drive.cruiseControl": { status: "has", certainty: "confirmed" },
  "drive.adaptiveCruise": { status: "no", certainty: "confirmed" },
  "lights.afl": { status: "has", certainty: "verify" },
  "engine.diesel": { status: "no", certainty: "probable" },
};

describe("getAvailability", () => {
  it("marks sections without tags as neutral", () => {
    expect(getAvailability([], PROFILE).kind).toBe("neutral");
  });

  it("treats features without a state as unknown", () => {
    expect(getAvailability(["drive.towbar"], PROFILE).kind).toBe("neutral");
    expect(getAvailability(["drive.cruiseControl"], {}).kind).toBe("neutral");
  });

  it("marks owned features as 'yours'", () => {
    expect(getAvailability(["drive.cruiseControl"], PROFILE).kind).toBe(
      "yours",
    );
  });

  it("marks missing equipment, even when combined with owned features", () => {
    const a = getAvailability(
      ["drive.cruiseControl", "drive.adaptiveCruise"],
      PROFILE,
    );
    expect(a.kind).toBe("missing");
    expect(a.missing).toEqual(["drive.adaptiveCruise"]);
  });

  it("flags features to verify and probable ones", () => {
    expect(getAvailability(["lights.afl"], PROFILE).kind).toBe("verify");
    expect(getAvailability(["engine.diesel"], PROFILE).kind).toBe("missing");
    expect(
      getAvailability(["engine.diesel"], {
        "engine.diesel": { status: "has", certainty: "probable" },
      }).kind,
    ).toBe("probable");
  });

  it("includes the OnStar note", () => {
    const a = getAvailability(["infotainment.onstar"], {
      "infotainment.onstar": { status: "has", certainty: "confirmed" },
    });
    expect(a.notes.join(" ")).toMatch(/OnStar/);
  });
});

describe("suggestFromSpec", () => {
  it("suggests only what the fuel type implies", () => {
    expect(suggestFromSpec(undefined)).toEqual({});
    const diesel = suggestFromSpec({
      fuel: "diesel",
      engineCm3: 1956,
      powerKw: 125,
      label: "2.0 CDTI",
    });
    expect(diesel["engine.diesel"]).toEqual({
      status: "has",
      certainty: "probable",
    });
    expect(diesel["engine.plugin"]?.status).toBe("no");
    expect(diesel["drive.towbar"]).toBeUndefined();
  });
});

describe("feature rules", () => {
  const tags = (title: string) => matchFeatures("any", title);

  it("tags typical section titles of any brand", () => {
    expect(tags("System Start/Stop")).toContain("drive.startStop");
    expect(tags("Climatronic")).toEqual(["climate.electronic"]);
    expect(tags("Klimatyzacja automatyczna")).toEqual(["climate.electronic"]);
    expect(tags("Adaptacyjny tempomat")).toEqual(["drive.adaptiveCruise"]);
    expect(tags("Tempomat")).toEqual(["drive.cruiseControl"]);
    expect(tags("Ostrzeganie o niezamierzonej zmianie pasa ruchu")).toContain(
      "assist.laneDeparture",
    );
    expect(tags("Czujniki parkowania")).toEqual(["assist.parkSensors"]);
    expect(tags("Zaawansowany asystent parkowania")).toEqual([
      "assist.advancedParkAssist",
    ]);
    expect(tags("Napęd na cztery koła 4MOTION")).toContain("drive.allWheel");
    expect(tags("Ładowanie akumulatora wysokiego napięcia")).toContain(
      "engine.plugin",
    );
    expect(tags("System nagłośnienia Bose")).toContain(
      "infotainment.premiumAudio",
    );
    expect(tags("Apple CarPlay i Android Auto")).toContain(
      "infotainment.phoneProjection",
    );
  });

  it("does not offer body construction or error messages as optional equipment", () => {
    for (const title of [
      "Składany dach",
      "Dach",
      "Komunikaty o błędach",
      "Bagażnik dachowy",
    ])
      expect(tags(title)).not.toContain("roof.electric");
    expect(
      FEATURES.some((feature) => String(feature.id) === "roof.electric"),
    ).toBe(false);
    expect(tags("Szyberdach")).toEqual(["comfort.sunroof"]);
    expect(tags("Komfortowe otwieranie szyb")).not.toContain("roof.remote");
    expect(tags("Otwieranie dachu za pomocą pilota")).toContain("roof.remote");
  });

  describe("exclusive equipment", () => {
    it("suggests and hides the alternative in either direction for every exclusive group", () => {
      for (const group of EXCLUSIVE_FEATURES) {
        for (const id of group) {
          const profile: VehicleProfile = {
            [id]: { status: "has", certainty: "confirmed" },
          };
          const effective = withExclusiveFeatures(profile);
          for (const other of group.filter((feature) => feature !== id)) {
            expect(effective[other]).toEqual({
              status: "no",
              certainty: "probable",
            });
            expect(getAvailability([other], profile).kind).toBe("missing");
            expect(profile[other]).toBeUndefined();
          }
          expect(withExclusiveFeatures(effective)).toEqual(effective);
        }
      }
    });

    it("withdraws inferred negatives when the source choice is cleared or changed to no", () => {
      const profile = chooseFeature({}, "transmission.automatic", {
        status: "has",
        certainty: "confirmed",
      });
      expect(
        withExclusiveFeatures(profile)["transmission.manual"]?.status,
      ).toBe("no");
      for (const state of [
        null,
        { status: "no", certainty: "confirmed" },
      ] as const)
        expect(
          withExclusiveFeatures(
            chooseFeature(profile, "transmission.automatic", state),
          )["transmission.manual"],
        ).toBeUndefined();
    });

    it("lets the latest has choice replace a conflicting has and keeps explicit no confirmations", () => {
      const automatic: VehicleProfile = {
        "transmission.automatic": { status: "has", certainty: "confirmed" },
      };
      const manual = chooseFeature(automatic, "transmission.manual", {
        status: "has",
        certainty: "confirmed",
      });
      expect(withExclusiveFeatures(manual)["transmission.automatic"]).toEqual({
        status: "no",
        certainty: "probable",
      });
      const confirmed = chooseFeature(manual, "transmission.automatic", {
        status: "no",
        certainty: "confirmed",
      });
      expect(
        withExclusiveFeatures(confirmed)["transmission.automatic"]?.certainty,
      ).toBe("confirmed");
      expect(automatic["transmission.automatic"].status).toBe("has");
    });

    it("does not invent exclusions for equipment that can coexist", () => {
      const profile: VehicleProfile = {
        "seats.heated": { status: "has", certainty: "confirmed" },
        "wheels.spare": { status: "has", certainty: "confirmed" },
        "assist.rearCamera": { status: "has", certainty: "confirmed" },
        "lights.afl": { status: "has", certainty: "confirmed" },
      };
      expect(withExclusiveFeatures(profile)).toEqual(profile);
    });
  });

  it("only uses known feature ids", () => {
    const ids = new Set<string>(FEATURES.map((f) => f.id));
    for (const title of [
      "Diesel",
      "LPG",
      "Hak holowniczy",
      "Kamera cofania",
      "Nawigacja",
    ])
      for (const id of tags(title)) expect(ids.has(id)).toBe(true);
  });
});

describe("getFeatureTree", () => {
  const ctx = {
    car: { id: "car" } as CarFile,
    book: { id: "manual", route: "manual", title: "M", short: "M" },
  } satisfies BookCtx;
  const h = (id: string, level: 2 | 3, text: string): Block => ({
    type: "heading",
    id,
    level,
    runs: [text],
  });
  const p = (id: string): Block => ({ type: "paragraph", id, runs: ["x"] });

  it("groups parts under headings that mention equipment", () => {
    const tree = getFeatureTree(
      ctx,
      [
        p("b1"),
        h("b2", 2, "Automatyczna kontrola prędkości"),
        p("b3"),
        h("b4", 3, "Włączanie"),
        p("b5"),
        h("b6", 2, "Hamulce"),
        p("b7"),
      ],
      [],
    );
    expect(tree.map((n) => n.kind)).toEqual([
      "block",
      "part",
      "block",
      "block",
    ]);
    const part = tree[1];
    expect(part.kind === "part" && part.features).toEqual([
      "drive.cruiseControl",
    ]);
    expect(part.kind === "part" && part.children.length).toBe(3);
  });

  it("skips features already inherited from the section", () => {
    const tree = getFeatureTree(
      ctx,
      [h("b1", 2, "Tempomat"), p("b2")],
      ["drive.cruiseControl"],
    );
    expect(tree.every((n) => n.kind === "block")).toBe(true);
  });
});

describe("search helpers", () => {
  it("normalizes Polish diacritics", () => {
    expect(normalizeText("Światła DROGOWE, łożysko, źródło")).toBe(
      "swiatla drogowe, lozysko, zrodlo",
    );
  });

  it("builds an excerpt around the first match", () => {
    const text = `${"a ".repeat(100)}ciśnienie w oponach ${"b ".repeat(100)}`;
    const e = excerpt(text, ["cisnienie"], 20);
    expect(e).toContain("ciśnienie");
    expect(e.startsWith("…")).toBe(true);
  });
});
