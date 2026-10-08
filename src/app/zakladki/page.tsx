import type { Metadata } from "next";
import { listCarSummaries } from "@/lib/content";
import { BookmarksView } from "./BookmarksView";

export const metadata: Metadata = { title: "Zakładki" };

export default function BookmarksPage() {
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Zakładki</h1>
      <BookmarksView cars={listCarSummaries()} />
    </main>
  );
}
