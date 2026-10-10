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
import { CarCardTitle } from "@/components/car/CarCardTitle";

/** Cars in the shared manuals library that are not yet assigned to this profile. */
export function AvailableCars({ cars }: { cars: CarSummary[] }) {
  const router = useRouter();
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const available = hydrated
    ? cars.filter((car) => !settings.ownedCars.includes(car.id))
    : [];

  if (!hydrated) return null;

  return (
    <section aria-labelledby="available-cars-title" className="mt-6">
      <h2 id="available-cars-title" className="section-label">
        Auta z gotowymi instrukcjami
      </h2>
      {available.length === 0 ? (
        <p className="panel p-4 text-sm text-graphite">
          {cars.length === 0
            ? "Nie ma jeszcze aut z gotowymi instrukcjami. Możesz dodać własne auto poniżej."
            : "Wszystkie auta z gotowymi instrukcjami są już dodane do Twojego profilu."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((car) => (
            <li key={car.id} className="panel flex flex-col">
              <div className="panel-title">{car.brand}</div>
              <div className="flex flex-1 flex-col p-4">
                <CarCardTitle car={car} />
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
      )}
    </section>
  );
}
