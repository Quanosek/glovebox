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
import {
  getAncestors,
  getBlocks,
  getBook,
  getBookByRoute,
  getChildren,
  getPrevNext,
  getSection,
  getSectionFeatures,
  sectionHref,
} from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { book: string } }) {
  const info = getBookByRoute(params.book);
  if (!info) return [];
  return getBook(info.id).sections.map((s) => ({ slug: s.slug }));
}

async function load(params: PageProps<"/[book]/[...slug]">["params"]) {
  const { book, slug } = await params;
  const info = getBookByRoute(book);
  const section = info ? getSection(info.id, slug) : undefined;
  if (!info || !section) notFound();
  return { info, section };
}

export async function generateMetadata({
  params,
}: PageProps<"/[book]/[...slug]">): Promise<Metadata> {
  const { section } = await load(params);
  return { title: section.title };
}

export default async function SectionPage({
  params,
}: PageProps<"/[book]/[...slug]">) {
  const { info, section } = await load(params);
  const index = getBook(info.id);
  const href = sectionHref(info.id, section);
  const ancestors = getAncestors(info.id, section);
  const features = getSectionFeatures(info.id, section);
  const children = getChildren(info.id, section);
  const { prev, next } = getPrevNext(info.id, section);
  const blocks = getBlocks(info.id, section);

  return (
    <article>
      <ReadingTracker
        book={info.id}
        sectionId={section.id}
        title={section.title}
        href={href}
      />
      <nav aria-label="Ścieżka" className="mb-4 text-xs text-steel">
        <ol className="flex flex-wrap gap-x-1.5">
          <li>
            <Link href={`/${info.route}`} className="hover:text-red">
              {index.title}
            </Link>
          </li>
          {ancestors.map((a) => (
            <li key={a.id}>
              ›{" "}
              <Link href={sectionHref(info.id, a)} className="hover:text-red">
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
              book={info.id}
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
          book={info.id}
          sectionId={section.id}
          sectionTitle={section.title}
          href={href}
        >
          {blocks.length > 0 ? (
            <BlockRenderer book={info.id} blocks={blocks} />
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
              href: sectionHref(info.id, c),
              page: c.page,
              features: getSectionFeatures(info.id, c),
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
            href={sectionHref(info.id, prev)}
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
            href={sectionHref(info.id, next)}
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
