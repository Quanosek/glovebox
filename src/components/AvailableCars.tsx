"use client";

import { useRouter } from "next/navigation";
import type { CarSummary } from "@/lib/cars";
import {
  addOwnedCar,
  setActiveCar,
  useAppData,
  useHydrated,
} from "@/lib/storage/hooks";
import { plural } from "@/lib/typography";

/** Cars in the shared manuals library that are not yet assigned to this profile. */
export function AvailableCars({ cars }: { cars: CarSummary[] }) {
  const router = useRouter();
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const available = hydrated
    ? cars.filter((car) => !settings.ownedCars.includes(car.id))
    : [];

  if (!hydrated || available.length === 0) return null;

  return (
    <section aria-labelledby="available-cars-title" className="mt-6">
      <h2
        id="available-cars-title"
        className="mb-3 text-xs font-semibold tracking-[0.08em] text-graphite uppercase"
      >
        Dostępne auta
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((car) => (
          <li key={car.id} className="panel flex flex-col">
            <div className="panel-title">{car.brand}</div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-lg leading-tight font-semibold">
                {car.model}{" "}
                <span className="font-normal text-steel">{car.year}</span>
              </h3>
              {car.variant && (
                <p className="mt-1 text-sm text-graphite">{car.variant}</p>
              )}
              <p className="mt-2 text-sm text-graphite">
                {car.books.length}{" "}
                {plural(
                  car.books.length,
                  "instrukcja",
                  "instrukcje",
                  "instrukcji",
                )}
              </p>
              <button
                type="button"
                className="btn btn-primary mt-4 justify-center"
                onClick={() => {
                  addOwnedCar(car.id);
                  setActiveCar(car.id);
                  router.push(car.href);
                }}
              >
                Dodaj i otwórz
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
