import type { Metadata } from "next";
import { listCarSummaries } from "@/lib/content";
import { CommentsView } from "./CommentsView";

export const metadata: Metadata = { title: "Moje komentarze" };

export default function CommentsPage() {
  return (
    <main
      id="main"
      className="page-shell"
    >
      <h1 className="page-title">
        Moje komentarze
      </h1>
      <CommentsView cars={listCarSummaries()} />
    </main>
  );
}
