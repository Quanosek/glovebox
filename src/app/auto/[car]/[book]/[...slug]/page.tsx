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
import { bookHref, carHref, carLabel } from "@/lib/cars";
import {
  getAncestors,
  getBlocks,
  getBook,
  getBookCtx,
  getChildren,
  getPrevNext,
  getSection,
  getSectionFeatures,
  sectionHref,
} from "@/lib/content";

type Props = PageProps<"/auto/[car]/[book]/[...slug]">;

async function load(params: Props["params"]) {
  const { car, book, slug } = await params;
  const ctx = getBookCtx(car, book);
  const section = ctx ? getSection(ctx, slug) : undefined;
  if (!ctx || !section) notFound();
  return { ctx, section };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ctx, section } = await load(params);
  return { title: `${section.title} — ${carLabel(ctx.car)}` };
}

export default async function SectionPage({ params }: Props) {
  const { ctx, section } = await load(params);
  const index = getBook(ctx);
  const href = sectionHref(ctx, section);
  const ancestors = getAncestors(ctx, section);
  const features = getSectionFeatures(ctx, section);
  const children = getChildren(ctx, section);
  const { prev, next } = getPrevNext(ctx, section);
  const blocks = getBlocks(ctx, section);
  const ref = { car: ctx.car.id, book: ctx.book.id };

  return (
    <article>
      <ReadingTracker
        {...ref}
        sectionId={section.id}
        title={section.title}
        href={href}
      />
      <nav aria-label="Ścieżka" className="mb-4 text-xs text-steel">
        <ol className="flex flex-wrap gap-x-1.5">
          <li>
            <Link href={carHref(ctx.car.id)} className="hover:text-red">
              {carLabel(ctx.car)}
            </Link>
          </li>
          <li>
            ›{" "}
            <Link
              href={bookHref(ctx.car.id, ctx.book.route)}
              className="hover:text-red"
            >
              {index.title}
            </Link>
          </li>
          {ancestors.map((a) => (
            <li key={a.id}>
              ›{" "}
              <Link href={sectionHref(ctx, a)} className="hover:text-red">
                {a.title}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <header className="border-b-2 border-red pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl leading-tight font-semibold">
            {section.title}
          </h1>
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
            <BlockRenderer ctx={ctx} blocks={blocks} />
          ) : (
            children.length === 0 && (
              <p className="text-steel">Ta sekcja nie zawiera treści.</p>
            )
          )}
        </HighlightLayer>
      </SectionGate>

      {children.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] text-graphite uppercase">
            W tej sekcji
          </h2>
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

      <nav
        aria-label="Nawigacja między sekcjami"
        className="mt-10 grid gap-2 sm:grid-cols-2 print:hidden"
      >
        {prev ? (
          <Link
            href={sectionHref(ctx, prev)}
            className="btn h-auto flex-col items-start py-2 whitespace-normal"
          >
            <span className="text-xs text-steel">‹ Poprzednia</span>
            <span>{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={sectionHref(ctx, next)}
            className="btn h-auto flex-col items-end py-2 text-right whitespace-normal"
          >
            <span className="text-xs text-steel">Następna ›</span>
            <span>{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
