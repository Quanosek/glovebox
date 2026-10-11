import {
  FEATURE_BY_ID,
  withExclusiveFeatures,
  type VehicleProfile,
} from "@/config/vehicle";

/**
 * Availability of a content section for the owner's car, derived from the
 * section's feature tags and the (possibly user-edited) vehicle profile.
 * Client-safe: no Node APIs.
 */
export type AvailabilityKind =
  "neutral" | "yours" | "verify" | "probable" | "missing";

export interface Availability {
  kind: AvailabilityKind;
  /** Features the car does not have (status "no"). */
  missing: string[];
  /** Features marked "do weryfikacji". */
  verify: string[];
  /** Features marked "prawdopodobnie". */
  probable: string[];
  /** Features the car has. */
  present: string[];
  /** Polish notes of the involved features. */
  notes: string[];
}

export const AVAILABILITY_LABEL: Record<AvailabilityKind, string> = {
  neutral: "",
  yours: "Twoje auto",
  verify: "Do weryfikacji",
  probable: "Prawdopodobnie",
  missing: "Brak w Twoim aucie",
};

export function getAvailability(
  features: readonly string[],
  profile: VehicleProfile,
): Availability {
  const effectiveProfile = withExclusiveFeatures(profile);
  const a: Availability = {
    kind: "neutral",
    missing: [],
    verify: [],
    probable: [],
    present: [],
    notes: [],
  };
  for (const id of features) {
    const state = effectiveProfile[id];
    const def = FEATURE_BY_ID[id];
    if (!state || !def) continue;
    if (state.status === "no") a.missing.push(id);
    else a.present.push(id);
    if (state.certainty === "verify") a.verify.push(id);
    if (state.certainty === "probable") a.probable.push(id);
    if (def.note && !a.notes.includes(def.note)) a.notes.push(def.note);
  }
  if (a.missing.length > 0) a.kind = "missing";
  else if (a.verify.length > 0) a.kind = "verify";
  else if (a.probable.length > 0) a.kind = "probable";
  else if (a.present.length > 0) a.kind = "yours";
  return a;
}

export function featureLabel(id: string): string {
  return FEATURE_BY_ID[id]?.label ?? id;
}
