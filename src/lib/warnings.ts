import type { WarningKind } from "@/content/types";
import { plural } from "@/lib/typography";

/**
 * Warning kinds of the manuals, in order of severity. Shared by the warnings
 * list (filters) and the car page (counts) so both show the same categories
 * with the same names. Client-safe.
 */
export const WARNING_KINDS: {
  id: WarningKind;
  /** URL value of `/ostrzezenia?rodzaj=`. */
  slug: string;
  /** Filter label on the warnings list. */
  label: string;
  /** Count label: one, few, many. */
  forms: [string, string, string];
  /** Shown in the red accent (danger and warning). */
  red: boolean;
}[] = [
  {
    id: "danger",
    slug: "niebezpieczenstwo",
    label: "Niebezpieczeństwo",
    forms: ["niebezpieczeństwo", "niebezpieczeństwa", "niebezpieczeństw"],
    red: true,
  },
  {
    id: "warning",
    slug: "ostrzezenie",
    label: "Ostrzeżenie",
    forms: ["ostrzeżenie", "ostrzeżenia", "ostrzeżeń"],
    red: true,
  },
  {
    id: "caution",
    slug: "przestroga",
    label: "Przestroga",
    forms: ["przestroga", "przestrogi", "przestróg"],
    red: false,
  },
  {
    id: "note",
    slug: "uwaga",
    label: "Uwaga",
    forms: ["uwaga", "uwagi", "uwag"],
    red: false,
  },
];

export function warningKindLabel(kind: WarningKind, count: number): string {
  const forms = WARNING_KINDS.find((k) => k.id === kind)!.forms;
  return plural(count, ...forms);
}

/** Kind of a `rodzaj` URL value; null for "all" or an unknown value. */
export function warningKindFromSlug(slug: unknown): WarningKind | null {
  return WARNING_KINDS.find((k) => k.slug === slug)?.id ?? null;
}

/** Warnings list of a car, optionally filtered to one kind. */
export function warningsHref(carId: string, kind?: WarningKind): string {
  const slug = kind && WARNING_KINDS.find((k) => k.id === kind)?.slug;
  const params = new URLSearchParams({ car: carId });
  if (slug) params.set("rodzaj", slug);
  return `/ostrzezenia?${params}`;
}
