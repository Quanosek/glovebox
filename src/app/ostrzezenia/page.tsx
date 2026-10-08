import type { Metadata } from "next";
import { BOOKS, blockToText, getAllWarnings, getBookInfo } from "@/lib/content";
import { WarningsList, type WarningItem } from "./WarningsList";

export const metadata: Metadata = { title: "Ostrzeżenia" };

export default function WarningsPage() {
  const items: WarningItem[] = getAllWarnings().map((w) => ({
    id: `${w.book}:${w.section.id}:${w.block.id}`,
    book: getBookInfo(w.book).short,
    kind: w.block.kind,
    title: w.block.title,
    section: w.section.title,
    href: w.href,
    page: w.block.page ?? w.section.page,
    text: w.block.blocks.map(blockToText).join(" "),
    features: w.features,
  }));

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8"
    >
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">
        Indeks ostrzeżeń
      </h1>
      <p className="mt-3 text-sm text-graphite">
        Wszystkie ostrzeżenia, przestrogi i uwagi z {BOOKS.length} ksiąg, z
        odnośnikami do miejsca w instrukcji.
      </p>
      <WarningsList items={items} />
    </main>
  );
}
