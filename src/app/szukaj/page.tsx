import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/Skeleton";
import { listCarSummaries } from "@/lib/content";
import { SearchView } from "./SearchView";

export const metadata: Metadata = { title: "Szukaj" };

export default function SearchPage() {
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Szukaj w instrukcjach</h1>
      <Suspense
        fallback={
          <div className="mt-4 space-y-4" aria-busy="true">
            <div className="panel p-4">
              <Skeleton className="h-10 w-full" />
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} className="panel space-y-3 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        }
      >
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
