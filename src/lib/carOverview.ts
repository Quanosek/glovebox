import type { WarningKind } from "@/content/types";
import {
  ESSENTIALS,
  TECHNICAL_SECTION,
  essentialsSize,
  pickEssential,
  type EssentialCandidate,
} from "@/config/essentials";
import type { CarFile } from "@/lib/cars";
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
  isMeasurementTable,
  shorten,
  tableFacts,
  textFacts,
  type CarStats,
  type EssentialTile,
  type TechCard,
  type Tip,
} from "@/lib/overview";
import type { SectionMeta } from "@/content/types";
import { enginesFromTables } from "@/lib/engines";
import type { CarSpec } from "@/lib/catalog";

/**
 * Server-side collection of the car overview data (docs/car-overview.md):
 * numbers, "Niezbędnik" tiles and "Dane techniczne" cards. Everything is
 * computed from the generated manuals in `database/` at render time and
 * memoised per car version. Never import this module from client components.
 */

export interface CarOverview {
  stats: CarStats;
  /** "Niezbędnik": 8, 6 or 4 tiles (fewer only for a manual that short). */
  essentials: EssentialTile[];
  techCount: number;
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
    const candidates: Array<
      EssentialCandidate & { href: string; book: string; page: number | null }
    > = [];
    const chapters: typeof candidates = [];
    for (const ctx of bookCtxs(car)) {
      const index = getBook(ctx);
      if (index.placeholder) continue;
      stats.books++;
      stats.pages += index.source.pages ?? 0;
      stats.sections += index.sections.length;
      for (const s of index.sections) {
        const href = sectionHref(ctx, s);
        const chain = [...getAncestors(ctx, s), s].map((x) => x.title);
        const section = {
          title: s.title,
          chain: chain.join(" › "),
          section: true,
          href,
          book: ctx.book.short,
          page: s.page ?? null,
        };
        candidates.push(section);
        if (s.level === 1) chapters.push(section);
        for (const b of getBlocks(ctx, s)) {
          if (b.type === "heading")
            candidates.push({
              ...section,
              title: blockToText(b).trim(),
              section: false,
              href: `${href}#${b.id}`,
              page: b.page ?? section.page,
            });
          else if (b.type === "warning") warnings[b.kind]++;
          else if (b.type === "image") {
            if (b.icon) stats.icons++;
            else stats.illustrations++;
          }
        }
      }
    }
    // One place per tile: a section shared by two topics goes to the first.
    const used = new Set<string>();
    const essentials: EssentialTile[] = [];
    let serviceHref: string | null = null;
    for (const topic of ESSENTIALS) {
      const hit = pickEssential(
        topic,
        candidates.filter((c) => !used.has(c.href)),
      );
      if (!hit) continue;
      used.add(hit.href);
      if (topic.id === "service") serviceHref = hit.href;
      essentials.push({
        id: topic.id,
        label: topic.label,
        description: topic.description,
        href: hit.href,
        source: hit.section ? hit.chain : `${hit.chain} › ${hit.title}`,
        book: hit.book,
      });
    }
    // At least four tiles: a manual with few known topics adds its chapters.
    for (const c of chapters) {
      if (essentials.length >= 4) break;
      if (used.has(c.href)) continue;
      used.add(c.href);
      essentials.push({
        id: "chapter",
        label: c.title,
        description:
          c.page != null
            ? `Rozdział instrukcji od str. ${c.page}.`
            : "Rozdział instrukcji.",
        href: c.href,
        source: c.title,
        book: c.book,
      });
    }
    const tech = getTechCards(car);
    return {
      stats,
      essentials: essentials.slice(0, essentialsSize(essentials.length)),
      techCount: tech.reduce((n, c) => n + c.tables.length, 0),
      serviceHref,
    };
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
        let title = s.title;
        for (const b of blocks) {
          if (b.type === "heading") title = blockToText(b);
          if (b.type !== "table" || b.rows.length === 0) continue;
          if (!technical && !isMeasurementTable(b)) continue;
          const engineTable = b.rows.some((row) =>
            /^silnik$|oznaczenie kodowe.*silnik|kod silnika/i.test(
              row[0] ?? "",
            ),
          );
          const facts = engineTable ? null : tableFacts(b);
          tables.push(
            facts
              ? {
                  kind: "facts",
                  id: b.id,
                  href: `${href}#${b.id}`,
                  title,
                  facts,
                }
              : {
                  kind: "table",
                  id: b.id,
                  href: `${href}#${b.id}`,
                  header: b.header,
                  rows: b.rows,
                  title,
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

export function getManualEngines(car: CarFile): CarSpec[] {
  return cached(car, "engines", () =>
    enginesFromTables(
      bookCtxs(car).flatMap((ctx) =>
        getBook(ctx).sections.flatMap((s) =>
          getBlocks(ctx, s).filter((b) => b.type === "table"),
        ),
      ),
    ),
  );
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
