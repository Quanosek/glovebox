import type { Metadata } from "next";
import { BookmarksView } from "./BookmarksView";

export const metadata: Metadata = { title: "Zakładki" };

export default function BookmarksPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">Zakładki</h1>
      <BookmarksView />
    </main>
  );
}
