import type {
  Block,
  ImageBlock,
  Run,
  TableBlock,
  WarningKind,
} from "@/content/types";
import { FUEL_LABEL, type CarSpec } from "@/lib/catalog";
import type { QuickTopicId } from "@/config/quickTopics";

/**
 * Pure helpers and shared types for the car overview screens (car page,
 * "Lampki kontrolne", "Dane techniczne", reader extras). Client-safe: the
 * server-side collection lives in `src/lib/carOverview.ts`.
 */

export function runsToText(runs: Run[]): string {
  return runs
    .map((r) =>
      typeof r === "string" ? r : "page" in r ? `str. ${r.page}` : r.t,
    )
    .join("");
}

export function blockToText(block: Block): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return runsToText(block.runs);
    case "list":
      return block.items.map(runsToText).join("\n");
    case "warning":
      return [block.title, ...block.blocks.map(blockToText)].join("\n");
    case "table":
      return block.rows.map((r) => r.join(" | ")).join("\n");
    case "image":
      return "";
  }
}

/** Shortens text to `max` characters at a word boundary, adding "…". */
export function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

/** First illustration (not a pictogram) of a section, used as thumbnail. */
export function firstIllustration(blocks: Block[]): ImageBlock | null {
  for (const b of blocks)
    if (b.type === "image" && !b.icon && b.width >= 120 && b.height >= 80)
      return b;
  return null;
}

export interface IconEntry {
  /** Image block id (deep-link target). */
  id: string;
  src: string;
  width: number;
  height: number;
  text: string;
}

/**
 * Pictograms of a section paired with the text printed next to them: the
 * following paragraph or list (manuals print the symbol, then explain it).
 * Consecutive icons share the text that follows them.
 */
export function iconEntries(blocks: Block[], maxText = 220): IconEntry[] {
  const out: IconEntry[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== "image" || !b.icon) continue;
    let text = "";
    for (let j = i + 1; j < blocks.length && j <= i + 4; j++) {
      const n = blocks[j];
      if (n.type === "image" && n.icon) continue;
      if (n.type === "paragraph" || n.type === "list" || n.type === "heading")
        text = blockToText(n);
      break;
    }
    if (!text.trim()) continue;
    out.push({
      id: b.id,
      src: b.src,
      width: b.width,
      height: b.height,
      text: shorten(text, maxText),
    });
  }
  return out;
}

export interface TableFact {
  label: string;
  value: string;
}

/**
 * Label/value pairs of a two-column table (the usual shape of capacities,
 * pressures and dimensions). Null when the table has another shape.
 */
export function tableFacts(table: TableBlock): TableFact[] | null {
  const rows = table.header ? table.rows.slice(1) : table.rows;
  if (rows.length === 0) return null;
  if (!rows.every((r) => r.length === 2)) return null;
  const facts = rows
    .map(([label, value]) => ({ label: label.trim(), value: value.trim() }))
    .filter((f) => f.label && f.value);
  return facts.length > 0 ? facts : null;
}

/** A number followed by a unit of measurement ("4,5 l", "2,3 bar", "1 350 kg"). */
const MEASUREMENT =
  /\d(?:[\d\s.,–-]*\d)?\s?(?:l|ml|dm3|dm³|cm3|cm³|bar|kpa|psi|kg|t|mm|cm|m|km\/h|kw|km|nm|v|a|w|ah|obr\/min|°c|%|l\/100\s?km|g\/km)(?![a-ząćęłńóśźż0-9])/i;

/** True when the text carries a measured value. */
export const hasMeasurement = (text: string) => MEASUREMENT.test(text);

/**
 * True when a table outside the technical chapters still holds technical
 * data: at least two body rows and most of them carry a measured value.
 */
export function isMeasurementTable(table: TableBlock): boolean {
  const rows = table.header ? table.rows.slice(1) : table.rows;
  if (rows.length < 2) return false;
  const measured = rows.filter((r) => r.some(hasMeasurement)).length;
  return measured * 2 >= rows.length;
}

const TEXT_FACT = /^([^:\n]{3,60}?)\s*:\s*([^\n]{1,40})$/;

/**
 * "Label: value" lines with a measured value from paragraphs and lists (many
 * manuals print technical data as text instead of tables). Each run of at
 * least two consecutive facts becomes one group, keyed by its first block.
 */
export function textFacts(
  blocks: Block[],
): { id: string; facts: TableFact[] }[] {
  const groups: { id: string; facts: TableFact[] }[] = [];
  let current: { id: string; facts: TableFact[] } | null = null;
  const flush = () => {
    if (current && current.facts.length >= 2) groups.push(current);
    current = null;
  };
  for (const b of blocks) {
    const lines =
      b.type === "paragraph"
        ? [runsToText(b.runs)]
        : b.type === "list"
          ? b.items.map(runsToText)
          : null;
    if (!lines) {
      flush();
      continue;
    }
    for (const line of lines) {
      const m = TEXT_FACT.exec(line.trim());
      if (m && hasMeasurement(m[2])) {
        current ??= { id: b.id, facts: [] };
        current.facts.push({ label: m[1].trim(), value: m[2].trim() });
      } else flush();
    }
  }
  flush();
  return groups;
}

/** True when a value is worth showing large (it carries a number). */
export const isNumeric = (value: string) => /\d/.test(value);

/** kW → KM (metric horsepower), rounded. */
export const kwToHp = (kw: number) => Math.round(kw * 1.35962);

/** Engine description for the car card, e.g. "1,6 l · 125 kW (170 KM) · benzyna". */
export function specParts(spec: CarSpec): string[] {
  const parts: string[] = [];
  if (spec.engineCm3)
    parts.push(`${(spec.engineCm3 / 1000).toFixed(1).replace(".", ",")} l`);
  parts.push(`${spec.powerKw} kW (${kwToHp(spec.powerKw)} KM)`);
  parts.push(FUEL_LABEL[spec.fuel]);
  return parts;
}

/* ------------------------------------------------------------- shared types */

export interface CarStats {
  books: number;
  pages: number;
  sections: number;
  illustrations: number;
  icons: number;
  warnings: Record<WarningKind, number>;
}

export interface QuickTile {
  id: QuickTopicId;
  label: string;
  href: string;
  /** Title of the section the tile opens and its book. */
  section: string;
  book: string;
}

export interface GlossaryGroup {
  section: string;
  book: string;
  href: string;
  items: Array<IconEntry & { href: string }>;
}

export interface TechCard {
  section: string;
  book: string;
  href: string;
  tables: Array<
    | { kind: "facts"; id: string; href: string; facts: TableFact[] }
    | {
        kind: "table";
        id: string;
        href: string;
        header: boolean;
        rows: string[][];
      }
  >;
}

export interface SectionThumb {
  title: string;
  href: string;
  thumb: string | null;
}

export interface Tip {
  car: string;
  title: string;
  text: string;
  href: string;
  section: string;
}
