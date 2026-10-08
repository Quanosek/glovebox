import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook, getBookByRoute, getChildren, getSectionFeatures, sectionHref } from "@/lib/content";
import { SectionList } from "@/components/SectionList";

export async function generateMetadata({ params }: PageProps<"/[book]">): Promise<Metadata> {
  const info = getBookByRoute((await params).book);
  return { title: info ? getBook(info.id).title : "Nie znaleziono" };
}

export default async function BookPage({ params }: PageProps<"/[book]">) {
  const info = getBookByRoute((await params).book);
  if (!info) notFound();
  const index = getBook(info.id);
  const chapters = getChildren(info.id, null);

  return (
    <article>
      <nav aria-label="Ścieżka" className="mb-4 text-xs text-steel">
        <Link href="/" className="hover:text-red">
          Start
        </Link>{" "}
        › <span className="text-ink">{index.title}</span>
      </nav>
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">{index.title}</h1>
      {index.placeholder && (
        <p className="mt-4 border-l-4 border-red bg-paper px-4 py-3 text-sm">
          Treść tej księgi nie została jeszcze wygenerowana z oficjalnego pliku PDF. Instrukcję
          generowania znajdziesz w pliku README.md (polecenia <code>npm run fetch-manuals</code> i{" "}
          <code>npm run extract</code>).
        </p>
      )}
      <p className="mt-4 text-sm text-graphite">
        Źródło:{" "}
        <span className="break-all">{index.source.file}</span>
        {index.source.pages ? ` · ${index.source.pages} stron` : ""}
        {index.source.extractedAt
          ? ` · wygenerowano ${new Date(index.source.extractedAt).toLocaleDateString("pl-PL")}`
          : ""}
      </p>
      <h2 className="mt-8 mb-2 text-xs font-semibold tracking-[0.08em] text-graphite uppercase">
        Rozdziały
      </h2>
      <SectionList
        items={chapters.map((s) => ({
          id: s.id,
          title: s.title,
          href: sectionHref(info.id, s),
          page: s.page,
          features: getSectionFeatures(info.id, s),
        }))}
      />
    </article>
  );
}
