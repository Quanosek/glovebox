import type { Metadata } from "next";
import { listCarSummaries } from "@/lib/content";
import { MIN_YEAR, maxYear } from "@/lib/server/importer";
import { AvailableCars } from "@/components/AvailableCars";
import { AddCarWizard } from "./AddCarWizard";

export const metadata: Metadata = { title: "Dodaj auto" };

export default function AddCarPage() {
  const cars = listCarSummaries();
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Dodaj auto</h1>
      <p className="mt-3 max-w-3xl text-sm text-graphite">
        Wybierz auto z dostępnych instrukcji albo dodaj własne. Wyposażenie
        dostosujesz później na stronie wybranego auta.
      </p>
      <a href="#nowe-auto" className="btn mt-4">
        Dodaj własne auto
      </a>
      <AvailableCars cars={cars} />
      <section id="nowe-auto" className="mt-8 scroll-mt-28">
        <h2 className="page-title">Dodaj własne auto</h2>
        <p className="mt-3 mb-5 max-w-3xl text-sm text-graphite">
          Wybierz markę, model i rocznik, a potem dołącz instrukcje w PDF.
          Zostaną odczytane i zapisane tylko na tym komputerze.
        </p>
      <AddCarWizard
        cars={cars}
        minYear={MIN_YEAR}
        maxYear={maxYear()}
      />
      </section>
    </main>
  );
}
