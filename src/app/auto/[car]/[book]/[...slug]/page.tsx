import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityBadges } from "@/components/AvailabilityBadges";
import { BlockRenderer } from "@/components/BlockRenderer";
import { BookmarkButton } from "@/components/BookmarkButton";
import { HighlightLayer } from "@/components/HighlightLayer";
import { ReadingTracker } from "@/components/ReadingTracker";
import { SectionGate } from "@/components/SectionGate";
import { SectionList } from "@/components/SectionList";
import { SectionHighlights } from "@/components/reader/SectionHighlights";
import { SectionOutline } from "@/components/reader/SectionOutline";
import type {
  Block,
  HeadingBlock,
  SectionMeta,
  WarningKind,
} from "@/content/types";
import { carLabel } from "@/lib/cars";
import { getSectionThumb } from "@/lib/carOverview";
import {
  getBlocks,
  getBookCtx,
  getChildren,
  getPrevNext,
  getSection,
  getSectionFeatures,
  sectionHref,
  type BookCtx,
} from "@/lib/content";
import { blockToText, shorten } from "@/lib/overview";
import { plural, polishTypography } from "@/lib/typography";

type Props = PageProps<"/auto/[car]/[book]/[...slug]">;

const WARNING_LABELS: Record<WarningKind, [string, string, string]> = {
  danger: ["niebezpieczeństwo", "niebezpieczeństwa", "niebezpieczeństw"],
  warning: ["ostrzeżenie", "ostrzeżenia", "ostrzeżeń"],
  caution: ["przestroga", "przestrogi", "przestróg"],
  note: ["uwaga", "uwagi", "uwag"],
};

/** Previous / next link with the first illustration of that section. */
function NeighbourLink({
  ctx,
  section,
  dir,
}: {
  ctx: BookCtx;
  section: SectionMeta;
  dir: "prev" | "next";
}) {
  const thumb = getSectionThumb(ctx, section);
  return (
    <Link
      href={sectionHref(ctx, section)}
      className={`panel hover-tile group flex h-full min-h-22 items-center gap-3 p-3 ${
        dir === "next" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {thumb && (
        <span className="thumb h-16 w-20 shrink-0 p-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- small local thumbnail */}
          <img src={thumb} alt="" loading="lazy" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-xs text-steel">
          {dir === "prev" ? "‹ Poprzedni rozdział" : "Następny rozdział ›"}
        </span>
        <span className="type-item block group-hover:text-red">
          {section.title}
        </span>
      </span>
    </Link>
  );
}

function warningCounts(blocks: Block[]) {
  const counts: Partial<Record<WarningKind, { n: number; first: string }>> = {};
  for (const b of blocks)
    if (b.type === "warning") {
      const c = counts[b.kind];
      if (c) c.n++;
      else counts[b.kind] = { n: 1, first: b.id };
    }
  return (Object.keys(WARNING_LABELS) as WarningKind[])
    .filter((k) => counts[k])
    .map((k) => ({ kind: k, ...counts[k]! }));
}

async function load(params: Props["params"]) {
  const { car, book, slug } = await params;
  const ctx = getBookCtx(car, book);
  const section = ctx ? getSection(ctx, slug) : undefined;
  if (!ctx || !section) notFound();
  return { ctx, section };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ctx, section } = await load(params);
  return { title: `${section.title} – ${carLabel(ctx.car)}` };
}

export default async function SectionPage({ params }: Props) {
  const { ctx, section } = await load(params);
  const href = sectionHref(ctx, section);
  const features = getSectionFeatures(ctx, section);
  const children = getChildren(ctx, section);
  const { prev, next } = getPrevNext(ctx, section);
  const blocks = getBlocks(ctx, section);
  const ref = { car: ctx.car.id, book: ctx.book.id };
  const headings = blocks.filter(
    (b): b is HeadingBlock => b.type === "heading" && b.level <= 3,
  );
  const warnings = warningCounts(blocks);

  return (
    <div className="reader-grid min-[90rem]:grid min-[90rem]:grid-cols-[minmax(0,48rem)_13rem] min-[90rem]:gap-10">
      <article className="min-w-0">
        <ReadingTracker
          {...ref}
          sectionId={section.id}
          title={section.title}
          href={href}
          thumb={getSectionThumb(ctx, section)}
        />
        <header className="border-b-2 border-red pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="type-title">{section.title}</h1>
            <div className="flex items-center gap-2 print:hidden">
              {section.page != null && (
                <span className="text-xs text-steel">str. {section.page}</span>
              )}
              <BookmarkButton
                {...ref}
                sectionId={section.id}
                title={section.title}
                href={href}
              />
            </div>
          </div>
        </header>
        <AvailabilityBadges features={features} />

        <SectionGate features={features}>
          <HighlightLayer
            {...ref}
            sectionId={section.id}
            sectionTitle={section.title}
            href={href}
          >
            {blocks.length > 0 ? (
              <BlockRenderer ctx={ctx} blocks={blocks} features={features} />
            ) : (
              children.length === 0 && (
                <p className="text-steel">Ta sekcja nie zawiera treści.</p>
              )
            )}
          </HighlightLayer>
        </SectionGate>

        {children.length > 0 && (
          <section className="mt-8">
            <h2 className="section-label mb-2">W tej sekcji</h2>
            <SectionList
              items={children.map((c) => ({
                id: c.id,
                title: c.title,
                href: sectionHref(ctx, c),
                page: c.page,
                features: getSectionFeatures(ctx, c),
              }))}
            />
          </section>
        )}

        {(prev || next) && (
          <nav
            aria-label="Nawigacja między rozdziałami"
            className="mt-10 flex flex-col gap-3 print:hidden"
          >
            {next && <NeighbourLink ctx={ctx} section={next} dir="next" />}
            {prev && <NeighbourLink ctx={ctx} section={prev} dir="prev" />}
          </nav>
        )}
      </article>
      <aside
        aria-label="Na tej stronie"
        className="hidden min-[90rem]:block print:hidden"
      >
        <div
          data-reader-sidebar
          className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100dvh-var(--header-h)-3rem)] space-y-6 overflow-y-auto pb-12"
        >
          {headings.length > 1 && (
            <SectionOutline
              key={href}
              headings={headings.map((h) => ({
                id: h.id,
                level: h.level,
                label: polishTypography(shorten(blockToText(h), 70)),
              }))}
            />
          )}
          {warnings.length > 0 && (
            <div>
              <h2 className="section-label mb-2">W tym rozdziale</h2>
              <ul className="space-y-1 text-sm">
                {warnings.map((w) => (
                  <li key={w.kind}>
                    <a
                      href={`#${w.first}`}
                      className={`hover:underline ${
                        w.kind === "danger" || w.kind === "warning"
                          ? "font-semibold text-red"
                          : "text-graphite"
                      }`}
                    >
                      {w.n} {plural(w.n, ...WARNING_LABELS[w.kind])}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SectionHighlights {...ref} sectionId={section.id} />
        </div>
      </aside>
    </div>
  );
}
