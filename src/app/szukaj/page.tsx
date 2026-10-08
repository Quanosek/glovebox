import type { Metadata } from "next";
import { Suspense } from "react";
import { listCarSummaries } from "@/lib/content";
import { SearchView } from "./SearchView";

export const metadata: Metadata = { title: "Szukaj" };

export default function SearchPage() {
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Szukaj w instrukcjach</h1>
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
