import { describe, expect, it } from "vitest";
import { matchFeatures } from "@/config/featureRules";
import { DEFAULT_PROFILE, resolveProfile } from "@/config/vehicle";
import { getAvailability } from "@/lib/availability";
import { excerpt, normalizeText } from "@/lib/search";

describe("getAvailability", () => {
  it("marks sections without tags as neutral", () => {
    expect(getAvailability([], DEFAULT_PROFILE).kind).toBe("neutral");
  });

  it("marks owned features as 'yours'", () => {
    expect(getAvailability(["drive.cruiseControl"], DEFAULT_PROFILE).kind).toBe("yours");
  });

  it("marks missing equipment, even when combined with owned features", () => {
    const a = getAvailability(["drive.cruiseControl", "drive.adaptiveCruise"], DEFAULT_PROFILE);
    expect(a.kind).toBe("missing");
    expect(a.missing).toEqual(["drive.adaptiveCruise"]);
  });

  it("flags features to verify and probable ones", () => {
    expect(getAvailability(["lights.afl"], DEFAULT_PROFILE).kind).toBe("verify");
    expect(getAvailability(["assist.advancedParkAssist"], DEFAULT_PROFILE).kind).toBe("probable");
  });

  it("includes the OnStar note", () => {
    const a = getAvailability(["infotainment.onstar"], DEFAULT_PROFILE);
    expect(a.notes.join(" ")).toMatch(/OnStar nie działa już w Europie/);
  });

  it("respects profile overrides", () => {
    const profile = resolveProfile({ "drive.cruiseControl": { status: "no", certainty: "confirmed" } });
    expect(getAvailability(["drive.cruiseControl"], profile).kind).toBe("missing");
  });
});

describe("feature rules", () => {
  it("tags typical section titles", () => {
    expect(matchFeatures("manual", "System Start/Stop")).toContain("drive.startStop");
    expect(matchFeatures("manual", "Adaptacyjny tempomat")).toEqual(["drive.adaptiveCruise"]);
    expect(matchFeatures("manual", "Tempomat")).toEqual(["drive.cruiseControl"]);
    expect(matchFeatures("manual", "Ostrzeganie o niezamierzonej zmianie pasa ruchu")).toContain(
      "assist.laneDeparture",
    );
    expect(matchFeatures("infotainment", "Navi 950 – wprowadzenie")).not.toContain(
      "infotainment.otherVariants",
    );
    expect(matchFeatures("infotainment", "CD 600 IntelliLink")).toContain("infotainment.otherVariants");
  });
});

describe("search helpers", () => {
  it("normalizes Polish diacritics", () => {
    expect(normalizeText("Światła DROGOWE, łożysko, źródło")).toBe("swiatla drogowe, lozysko, zrodlo");
  });

  it("builds an excerpt around the first match", () => {
    const text = `${"a ".repeat(100)}ciśnienie w oponach ${"b ".repeat(100)}`;
    const e = excerpt(text, ["cisnienie"], 20);
    expect(e).toContain("ciśnienie");
    expect(e.startsWith("…")).toBe(true);
  });
});
