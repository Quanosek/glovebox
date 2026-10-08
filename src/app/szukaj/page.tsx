import type { Metadata } from "next";
import { Suspense } from "react";
import { listCarSummaries } from "@/lib/content";
import { SearchView } from "./SearchView";

export const metadata: Metadata = { title: "Szukaj" };

export default function SearchPage() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8"
    >
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">
        Szukaj w instrukcjach
      </h1>
      <Suspense fallback={<p className="mt-4 text-steel">Ładowanie…</p>}>
        <SearchView
          cars={listCarSummaries().map((c) => ({
            id: c.id,
            label: c.label,
            books: c.books.map((b) => ({ id: b.id, short: b.short })),
          }))}
        />
      </Suspense>
    </main>
  );
}
