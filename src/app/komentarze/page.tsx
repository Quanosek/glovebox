import type { Metadata } from "next";
import { CommentsView } from "./CommentsView";

export const metadata: Metadata = { title: "Moje komentarze" };

export default function CommentsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">Moje komentarze</h1>
      <CommentsView />
    </main>
  );
}
