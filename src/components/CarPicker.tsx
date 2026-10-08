"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CarSummary } from "@/lib/cars";
import { setActiveCar, useAppData, useHydrated } from "@/lib/storage/hooks";

/** Grid of cars from `database/` plus the "add your own car" tile. */
export function CarPicker({ cars }: { cars: CarSummary[] }) {
  const router = useRouter();
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const active = hydrated ? settings.activeCar : null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cars.map((car) => {
        const isActive = car.id === active;
        const placeholder = car.books.every((b) => b.placeholder);
        return (
          <li
            key={car.id}
            className={`panel flex flex-col ${isActive ? "border-red" : ""}`}
          >
            <div className="panel-title flex items-center justify-between gap-2">
              <span>{car.brand}</span>
              {isActive && <span className="badge badge-red">Wybrane</span>}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-lg leading-tight font-semibold">
                {car.model}{" "}
                <span className="font-normal text-steel">{car.year}</span>
              </h3>
              {car.variant && (
                <p className="mt-1 text-sm text-graphite">{car.variant}</p>
              )}
              <ul className="mt-3 space-y-0.5 text-sm text-graphite">
                {car.books.map((b) => (
                  <li key={b.id} className="flex gap-2">
                    <span aria-hidden="true" className="text-red">
                      ▪
                    </span>
                    <span className="min-w-0">
                      {b.title}{" "}
                      <span className="text-xs text-steel">
                        {b.placeholder
                          ? "· do wygenerowania"
                          : `· ${b.sections} sekcji`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-steel">
                <code>database/{car.id}/</code>
                {car.builtIn ? " · w repozytorium" : " · dodane przez Ciebie"}
                {placeholder ? " · treść zastępcza" : ""}
              </p>
              <div className="mt-auto flex gap-2 pt-4">
                <button
                  type="button"
                  className={`btn flex-1 justify-center ${isActive ? "" : "btn-primary"}`}
                  onClick={() => {
                    setActiveCar(car.id);
                    router.push(car.href);
                  }}
                >
                  {isActive ? "Otwórz" : "Wybierz to auto"}
                </button>
              </div>
            </div>
          </li>
        );
      })}
      <li>
        <Link
          href="/dodaj-auto"
          className="group flex h-full min-h-56 flex-col items-center justify-center gap-2 border border-dashed border-silver bg-paper p-6 text-center hover:border-red hover:bg-white"
        >
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center border border-silver bg-white text-2xl text-red group-hover:border-red"
          >
            +
          </span>
          <span className="font-semibold group-hover:text-red">
            Dodaj własne auto
          </span>
          <span className="max-w-60 text-sm text-graphite">
            Marka, model, rocznik i do 10 plików PDF z instrukcjami.
          </span>
        </Link>
      </li>
    </ul>
  );
}
