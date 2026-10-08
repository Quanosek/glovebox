import type { Metadata } from "next";
import { NotebookView } from "./NotebookView";

export const metadata: Metadata = { title: "Notatnik" };

export default async function NotebookPage({
  searchParams,
}: PageProps<"/notatnik">) {
  const { kartka } = await searchParams;
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Notatnik</h1>
      <NotebookView
        initialPage={typeof kartka === "string" ? kartka : undefined}
      />
    </main>
  );
}
