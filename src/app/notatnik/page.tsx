import type { Metadata } from "next";
import { NotebookView } from "./NotebookView";

export const metadata: Metadata = { title: "Notatnik" };

export default async function NotebookPage({
  searchParams,
}: PageProps<"/notatnik">) {
  const { kartka } = await searchParams;
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8"
    >
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">
        Notatnik
      </h1>
      <NotebookView
        initialPage={typeof kartka === "string" ? kartka : undefined}
      />
    </main>
  );
}
