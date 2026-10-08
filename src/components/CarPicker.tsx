"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CarSummary } from "@/lib/cars";
import { useOfflineState, useOnline } from "@/lib/offline";
import { setActiveCar, useAppData, useHydrated } from "@/lib/storage/hooks";
import { plural } from "@/lib/typography";

/** Grid of cars from `database/` plus the "add your own car" tile. */
export function CarPicker({ cars }: { cars: CarSummary[] }) {
  const router = useRouter();
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const active = hydrated ? settings.activeCar : null;
  const online = useOnline();
  const { saved } = useOfflineState();

  return (
    <>
      {!online && (
        <p
          role="status"
          className="mb-4 border-l-4 border-graphite bg-paper px-4 py-2 text-sm"
        >
          Nie ma internetu. Lista aut może być nieaktualna – działają auta
          oznaczone „Bez internetu”. Nowe auta pojawią się po powrocie
          połączenia.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cars.map((car) => {
          const isActive = car.id === active;
          const placeholder = car.books.every((b) => b.placeholder);
          return (
            <li
              key={car.id}
              className={`panel hover-tile flex flex-col ${isActive ? "border-red" : ""}`}
            >
              <div className="panel-title flex items-center justify-between gap-2">
                <span>{car.brand}</span>
                <span className="flex gap-1">
                  {hydrated && saved[car.id] && (
                    <span
                      className="badge"
                      title="Instrukcje tego auta działają bez internetu"
                    >
                      Bez internetu
                    </span>
                  )}
                  {isActive && <span className="badge badge-red">Wybrane</span>}
                </span>
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
                            ? "· treść w przygotowaniu"
                            : `· ${b.sections} ${plural(b.sections, "sekcja", "sekcje", "sekcji")}`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {placeholder && (
                  <p className="mt-3 text-xs text-steel">
                    Treść jeszcze niegotowa
                  </p>
                )}
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
            className="group flex h-full min-h-56 flex-col items-center justify-center gap-2 border border-dashed border-silver bg-paper p-6 text-center transition-colors hover:border-red hover:bg-white"
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
              Wpisz markę, model i rocznik, a potem dołącz instrukcje w PDF.
            </span>
          </Link>
        </li>
      </ul>
    </>
  );
}
