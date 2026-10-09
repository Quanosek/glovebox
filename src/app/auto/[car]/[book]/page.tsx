import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carLabel } from "@/lib/cars";
import {
  getBook,
  getBookCtx,
  getChildren,
  getSectionFeatures,
  sectionHref,
} from "@/lib/content";
import { SectionList } from "@/components/SectionList";

type Props = PageProps<"/auto/[car]/[book]">;

async function load(params: Props["params"]) {
  const { car, book } = await params;
  return getBookCtx(car, book);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await load(params);
  return {
    title: ctx
      ? `${getBook(ctx).title} – ${carLabel(ctx.car)}`
      : "Nie znaleziono",
  };
}

export default async function BookPage({ params }: Props) {
  const ctx = await load(params);
  if (!ctx) notFound();
  const index = getBook(ctx);
  const chapters = getChildren(ctx, null);

  return (
    <article>
      <h1 className="page-title">{index.title}</h1>
      {index.placeholder && (
        <p className="mt-4 border-l-4 border-red bg-paper px-4 py-3 text-sm">
          Pełna treść tej instrukcji nie jest jeszcze gotowa – na razie widzisz
          tylko krótki wstęp. Osoba, która przygotowała aplikację, może ją
          uzupełnić (opis w pliku README). Możesz też dodać instrukcję
          samodzielnie z pliku PDF na stronie{" "}
          <Link href="/dodaj-auto" className="text-red underline">
            Dodaj auto
          </Link>
          .
        </p>
      )}
      <p className="mt-4 text-sm text-graphite">
        Źródło: <span className="break-all">{index.source.file}</span>
        {index.source.pages ? ` · ${index.source.pages} stron` : ""}
        {index.source.extractedAt
          ? ` · przygotowano ${new Date(index.source.extractedAt).toLocaleDateString("pl-PL")}`
          : ""}
      </p>
      <h2 className="section-label mt-8 mb-2">Rozdziały</h2>
      <SectionList
        items={chapters.map((s) => ({
          id: s.id,
          title: s.title,
          href: sectionHref(ctx, s),
          page: s.page,
          features: getSectionFeatures(ctx, s),
        }))}
      />
    </article>
  );
}
