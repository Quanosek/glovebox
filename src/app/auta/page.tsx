import type { Metadata } from "next";
import { CarPicker } from "@/components/CarPicker";
import { listCarSummaries } from "@/lib/content";

export const metadata: Metadata = { title: "Wybór auta" };

export default function CarsPage() {
  const cars = listCarSummaries();
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Wybór auta</h1>
      <p className="mt-3 mb-5 text-sm text-graphite">
        Liczba aut: {cars.length}. Wybierz swoje, aby czytać jego instrukcje,
        albo dodaj nowe z plików PDF.
      </p>
      <CarPicker cars={cars} />
    </main>
  );
}
