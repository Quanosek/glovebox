import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carHref, carLabel } from "@/lib/cars";
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
      ? `${getBook(ctx).title} — ${carLabel(ctx.car)}`
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
      <nav aria-label="Ścieżka" className="mb-4 text-xs text-steel">
        <Link href="/" className="hover:text-red">
          Profil
        </Link>{" "}
        ›{" "}
        <Link href={carHref(ctx.car.id)} className="hover:text-red">
          {carLabel(ctx.car)}
        </Link>{" "}
        › <span className="text-ink">{index.title}</span>
      </nav>
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">
        {index.title}
      </h1>
      {index.placeholder && (
        <p className="mt-4 border-l-4 border-red bg-paper px-4 py-3 text-sm">
          Treść tej księgi nie została jeszcze wygenerowana z oficjalnego pliku
          PDF. Instrukcję generowania znajdziesz w pliku README.md (polecenia{" "}
          <code>npm run fetch-manuals</code> i <code>npm run extract</code>)
          albo dodaj pliki PDF w kreatorze{" "}
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
          href: sectionHref(ctx, s),
          page: s.page,
          features: getSectionFeatures(ctx, s),
        }))}
      />
    </article>
  );
}
