import type { Metadata } from "next";
import { NotebookView } from "./NotebookView";

export const metadata: Metadata = { title: "Notatnik" };

export default function NotebookPage() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8"
    >
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">
        Notatnik
      </h1>
      <NotebookView />
    </main>
  );
}
