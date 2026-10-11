import type { Metadata } from "next";
import { listCarSummaries } from "@/lib/content";
import { MIN_YEAR, maxYear } from "@/lib/server/importer";
import { AddCarWizard } from "./AddCarWizard";

export const metadata: Metadata = { title: "Dodaj auto" };

export default function AddCarPage() {
  const cars = listCarSummaries();
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Dodaj auto</h1>
      <p className="mt-3 max-w-3xl text-sm text-graphite">
        Wybierz markę, model i rocznik, a potem dołącz instrukcje. Wyposażenie
        dostosujesz w kolejnych krokach.
      </p>
      <AddCarWizard cars={cars} minYear={MIN_YEAR} maxYear={maxYear()} />
    </main>
  );
}
