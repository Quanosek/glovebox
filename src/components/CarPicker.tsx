"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/Dialog";
import type { CarSummary } from "@/lib/cars";
import { forgetCarOffline, useOfflineState, useOnline } from "@/lib/offline";
import {
  addOwnedCar,
  removeOwnedCar,
  setActiveCar,
  useAppData,
  useHydrated,
} from "@/lib/storage/hooks";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { plural } from "@/lib/typography";

/** Grid of cars from `database/` plus the "add your own car" tile. */
export function CarPicker({
  cars,
  ownedCarIds,
}: {
  cars: CarSummary[];
  ownedCarIds?: string[];
}) {
  const router = useRouter();
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const active = hydrated ? settings.activeCar : hint.activeCar;
  const online = useOnline();
  const { saved } = useOfflineState();
  const hasCopy = (id: string) =>
    hydrated ? Boolean(saved[id]) : hint.offline.includes(id);
  const readableCars = cars.filter(
    (car) =>
      car.books.some((book) => !book.placeholder) &&
      (ownedCarIds === undefined || ownedCarIds.includes(car.id)),
  );

  const remove = async (car: CarSummary) => {
    const ok = await confirmDialog({
      title: "Usunąć auto z Twoich aut?",
      message: (
        <p>
          <strong>{car.label}</strong> zniknie z Twojej listy. Instrukcje i
          zapisane informacje nie zostaną usunięte. Auto możesz dodać ponownie.
        </p>
      ),
      confirmLabel: "Usuń z listy",
      danger: true,
    });
    if (ok) {
      removeOwnedCar(car.id);
      void forgetCarOffline(car.id);
    }
  };

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
        {readableCars.map((car) => {
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
                  {hasCopy(car.id) && (
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
                <h3 className="type-card">
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
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button
                    type="button"
                    className={`btn min-w-32 flex-1 justify-center ${isActive ? "" : "btn-primary"}`}
                    onClick={() => {
                      addOwnedCar(car.id);
                      setActiveCar(car.id);
                      router.push(car.href);
                    }}
                  >
                    {isActive ? "Otwórz" : "Wybierz to auto"}
                  </button>
                  {ownedCarIds !== undefined && (
                    <button
                      type="button"
                      className="btn btn-ghost justify-center"
                      aria-label={`Usuń ${car.label} z moich aut`}
                      title="Usuń z moich aut"
                      onClick={() => void remove(car)}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        width="18"
                        height="18"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M4 6h12m-10 0 .7 10h6.6L14 6M8 6V4h4v2m-3 3v4m2-4v4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="square"
                          strokeLinejoin="miter"
                        />
                      </svg>
                    </button>
                  )}
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
              Dodaj auto
            </span>
            <span className="max-w-60 text-sm text-graphite">
              Wybierz dostępne auto albo dodaj własne z instrukcji.
            </span>
          </Link>
        </li>
      </ul>
    </>
  );
}
