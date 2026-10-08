import type { Metadata } from "next";
import Link from "next/link";
import { CarPicker } from "@/components/CarPicker";
import { listCarSummaries } from "@/lib/content";

export const metadata: Metadata = { title: "Wybór auta" };

export default function CarsPage() {
  const cars = listCarSummaries();
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8"
    >
      <nav aria-label="Ścieżka" className="mb-4 text-xs text-steel">
        <Link href="/" className="hover:text-red">
          Profil
        </Link>{" "}
        › <span className="text-ink">Auta</span>
      </nav>
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">
        Wybór auta
      </h1>
      <p className="mt-3 mb-5 text-sm text-graphite">
        Liczba aut: {cars.length}. Wybierz swoje, aby czytać jego instrukcje,
        albo dodaj nowe z plików PDF.
      </p>
      <CarPicker cars={cars} />
    </main>
  );
}
