import type { Metadata } from "next";
import { Suspense } from "react";
import { listCarSummaries } from "@/lib/content";
import { SearchSkeleton, SearchView } from "./SearchView";

export const metadata: Metadata = { title: "Szukaj" };

export default function SearchPage() {
  const cars = listCarSummaries().map((c) => ({
    id: c.id,
    label: c.label,
    books: c.books.map((b) => ({ id: b.id, short: b.short })),
  }));
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Szukaj w instrukcjach</h1>
      <Suspense fallback={<SearchSkeleton cars={cars} />}>
        <SearchView cars={cars} />
      </Suspense>
    </main>
  );
}
