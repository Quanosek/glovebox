import type { WarningKind } from "@/content/types";
import {
  INDICATOR_SECTION,
  QUICK_TOPICS,
  QUICK_TOPICS_MAX,
  TECHNICAL_SECTION,
  matchQuickTopics,
  type QuickTopicId,
} from "@/config/quickTopics";
import { glossaryHref, type CarFile } from "@/lib/cars";
import {
  bookCtxs,
  getAncestors,
  getBlocks,
  getBook,
  getCarVersion,
  sectionHref,
  type BookCtx,
} from "@/lib/content";
import {
  blockToText,
  firstIllustration,
  hasMeasurement,
  iconEntries,
  isMeasurementTable,
  isNumeric,
  shorten,
  tableFacts,
  textFacts,
  type CarStats,
  type GlossaryGroup,
  type QuickTile,
  type TableFact,
  type TechCard,
  type Tip,
} from "@/lib/overview";
import type { SectionMeta } from "@/content/types";

/**
 * Server-side collection of the car overview data (docs/car-overview.md):
 * numbers, "Najczęściej potrzebne" tiles, the "Lampki kontrolne" glossary
 * and "Dane techniczne" cards. Everything is computed from the generated
 * manuals in `database/` at render time and memoised per car version.
 * Never import this module from client components.
 */

export interface CarOverview {
  stats: CarStats;
  tiles: QuickTile[];
  glossaryCount: number;
  techCount: number;
  /** A few numeric facts for the preview card on the car page. */
  techPreview: TableFact[];
  /** Section about periodic service, linked from the reminders. */
  serviceHref: string | null;
}

const memo = new Map<string, { version: string; value: unknown }>();

function cached<T>(car: CarFile, name: string, fn: () => T): T {
  const key = `${car.id}:${name}`;
  const version = getCarVersion(car);
  const hit = memo.get(key);
  if (hit && hit.version === version) return hit.value as T;
  const value = fn();
  memo.set(key, { version, value });
  return value;
}

function chainMatches(ctx: BookCtx, s: SectionMeta, re: RegExp): boolean {
  return [...getAncestors(ctx, s), s].some((x) => re.test(x.title));
}

export function getCarOverview(car: CarFile): CarOverview {
  return cached(car, "overview", () => {
    const warnings: Record<WarningKind, number> = {
      danger: 0,
      warning: 0,
      caution: 0,
      note: 0,
    };
    const stats: CarStats = {
      books: 0,
      pages: 0,
      sections: 0,
      illustrations: 0,
      icons: 0,
      warnings,
    };
    const found = new Map<QuickTopicId, QuickTile>();
    for (const ctx of bookCtxs(car)) {
      const index = getBook(ctx);
      if (index.placeholder) continue;
      stats.books++;
      stats.pages += index.source.pages ?? 0;
      stats.sections += index.sections.length;
      for (const s of index.sections) {
        for (const id of matchQuickTopics(s.title))
          if (!found.has(id))
            found.set(id, {
              id,
              label: QUICK_TOPICS.find((t) => t.id === id)!.label,
              href: sectionHref(ctx, s),
              section: s.title,
              book: ctx.book.short,
            });
        for (const b of getBlocks(ctx, s)) {
          if (b.type === "warning") warnings[b.kind]++;
          else if (b.type === "image") {
            if (b.icon) stats.icons++;
            else stats.illustrations++;
          }
        }
      }
    }
    const glossaryCount = getGlossary(car).reduce(
      (n, g) => n + g.items.length,
      0,
    );
    const indicators = found.get("indicators");
    if (glossaryCount > 0)
      found.set("indicators", {
        id: "indicators",
        label: "Lampki kontrolne",
        href: glossaryHref(car.id),
        section: indicators?.section ?? "Symbole z instrukcji",
        book: indicators?.book ?? "",
      });
    const tiles = QUICK_TOPICS.map((t) => found.get(t.id))
      .filter((t): t is QuickTile => Boolean(t))
      .slice(0, QUICK_TOPICS_MAX);
    const tech = getTechCards(car);
    const techPreview: TableFact[] = [];
    for (const card of tech)
      for (const t of card.tables)
        if (t.kind === "facts")
          for (const f of t.facts)
            if (
              techPreview.length < 4 &&
              isNumeric(f.value) &&
              hasMeasurement(f.value)
            )
              techPreview.push({
                label: shorten(f.label, 60),
                value: shorten(f.value, 40),
              });
    return {
      stats,
      tiles,
      glossaryCount,
      techCount: tech.reduce((n, c) => n + c.tables.length, 0),
      techPreview,
      serviceHref: found.get("service")?.href ?? null,
    };
  });
}

/** Pictograms with their explanation, grouped by section. */
export function getGlossary(car: CarFile): GlossaryGroup[] {
  return cached(car, "glossary", () => {
    const collect = (onlyIndicators: boolean) => {
      const groups: GlossaryGroup[] = [];
      const seen = new Set<string>();
      let total = 0;
      for (const ctx of bookCtxs(car)) {
        for (const s of getBook(ctx).sections) {
          if (onlyIndicators && !chainMatches(ctx, s, INDICATOR_SECTION))
            continue;
          const href = sectionHref(ctx, s);
          const items = iconEntries(getBlocks(ctx, s))
            .filter((e) => {
              const key = `${e.src}|${e.text.slice(0, 60)}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((e) => ({ ...e, href: `${href}#${e.id}` }));
          if (items.length === 0 || total >= 240) continue;
          total += items.length;
          groups.push({ section: s.title, book: ctx.book.short, href, items });
        }
      }
      return groups;
    };
    const indicators = collect(true);
    return indicators.length > 0 ? indicators : collect(false);
  });
}

/**
 * Technical data of a car: every table of the technical chapters (capacities,
 * pressures, dimensions…) plus "Label: value" lines printed as text there, and
 * tables elsewhere whose rows mostly carry measured values (bulbs, fuses,
 * tyre sizes).
 */
export function getTechCards(car: CarFile): TechCard[] {
  return cached(car, "tech", () => {
    const cards: TechCard[] = [];
    for (const ctx of bookCtxs(car)) {
      for (const s of getBook(ctx).sections) {
        const technical = chainMatches(ctx, s, TECHNICAL_SECTION);
        const href = sectionHref(ctx, s);
        const tables: TechCard["tables"] = [];
        const blocks = getBlocks(ctx, s);
        for (const b of blocks) {
          if (b.type !== "table" || b.rows.length === 0) continue;
          if (!technical && !isMeasurementTable(b)) continue;
          const facts = tableFacts(b);
          tables.push(
            facts
              ? { kind: "facts", id: b.id, href: `${href}#${b.id}`, facts }
              : {
                  kind: "table",
                  id: b.id,
                  href: `${href}#${b.id}`,
                  header: b.header,
                  rows: b.rows,
                },
          );
        }
        if (technical)
          for (const g of textFacts(blocks))
            tables.push({
              kind: "facts",
              id: `${g.id}-text`,
              href: `${href}#${g.id}`,
              facts: g.facts,
            });
        if (tables.length > 0)
          cards.push({ section: s.title, book: ctx.book.short, href, tables });
      }
    }
    return cards;
  });
}

/** First illustration of a section (thumbnail for history and navigation). */
export function getSectionThumb(
  ctx: BookCtx,
  section: SectionMeta,
): string | null {
  return firstIllustration(getBlocks(ctx, section))?.src ?? null;
}

/** "Czy wiesz, że…" tips: notes ("Uwaga") from the manuals of the given cars. */
export function getTips(cars: CarFile[], perCar = 30): Tip[] {
  const out: Tip[] = [];
  for (const car of cars) {
    const tips = cached(car, `tips:${perCar}`, () => {
      const list: Tip[] = [];
      for (const ctx of bookCtxs(car)) {
        for (const s of getBook(ctx).sections) {
          for (const b of getBlocks(ctx, s)) {
            if (b.type !== "warning" || b.kind !== "note") continue;
            const text = b.blocks.map(blockToText).join(" ");
            if (text.trim().length < 40) continue;
            list.push({
              car: car.id,
              title: b.title,
              text: shorten(text, 280),
              href: `${sectionHref(ctx, s)}#${b.id}`,
              section: s.title,
            });
          }
        }
      }
      // Spread over the whole manual rather than taking the first chapter.
      if (list.length <= perCar) return list;
      const step = list.length / perCar;
      return Array.from(
        { length: perCar },
        (_, i) => list[Math.floor(i * step)],
      );
    });
    out.push(...tips);
  }
  return out;
}
