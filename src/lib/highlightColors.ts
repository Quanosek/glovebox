import type { HighlightColor } from "@/lib/storage/schema";

/** Restricted highlight palette (silver/grey shades and red). */
export const HIGHLIGHT_COLORS: {
  id: HighlightColor;
  label: string;
  swatch: string;
}[] = [
  { id: "light", label: "Jasnosrebrny", swatch: "#D9DCDF" },
  { id: "silver", label: "Srebrny", swatch: "#B8BCC0" },
  { id: "graphite", label: "Grafitowy", swatch: "#8A8F94" },
  { id: "red",   label: "Czerwień", swatch: "#F2B8C2" },
];

/** Name of the CSS custom highlight used for a stored highlight. */
export function highlightName(
  color: HighlightColor,
  commented: boolean,
): string {
  return `hl-${color}${commented ? "-c" : ""}`;
}

export const ALL_HIGHLIGHT_NAMES = HIGHLIGHT_COLORS.flatMap((c) => [
  highlightName(c.id, false),
  highlightName(c.id, true),
]);
