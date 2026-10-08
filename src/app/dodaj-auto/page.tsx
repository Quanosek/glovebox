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
        Dodaj auto z instrukcji w PDF
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-graphite">
        Dodasz tu własne auto krok po kroku: wybierzesz je z aktualnej listy
        aut, dodasz instrukcje w PDF i zaznaczysz jego wyposażenie. Instrukcje
        są odczytywane i zapisywane tylko na tym komputerze.
      </p>
      <AddCarWizard
        cars={listCarSummaries()}
        minYear={MIN_YEAR}
        maxYear={maxYear()}
      />
    </main>
  );
}
