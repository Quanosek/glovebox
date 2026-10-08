import type { Metadata } from "next";
import { listCarSummaries } from "@/lib/content";
import { MIN_YEAR, maxYear } from "@/lib/server/importer";
import { AddCarWizard } from "./AddCarWizard";

export const metadata: Metadata = { title: "Dodaj auto" };

export default function AddCarPage() {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8"
    >
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">
        Dodaj auto z instrukcji PDF
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-graphite">
        Kreator przeprowadzi Cię krok po kroku przez dodanie własnego auta.
        Instrukcje w PDF są przetwarzane wyłącznie na tym komputerze przez
        lokalny serwer aplikacji, a wynik trafia do folderu{" "}
        <code>database/</code> w repozytorium.
      </p>
      <AddCarWizard
        cars={listCarSummaries()}
        minYear={MIN_YEAR}
        maxYear={maxYear()}
      />
    </main>
  );
}
