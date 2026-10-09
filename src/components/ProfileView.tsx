"use client";

import Link from "next/link";
import { useState } from "react";
import type { CarSummary } from "@/lib/cars";
import { carName } from "@/lib/cars";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";
import { CarPicker } from "./CarPicker";
import { ContinueReading } from "./ContinueReading";
import { Markdown } from "./Markdown";
import { Skeleton } from "./Skeleton";
import { PROFILE_NOTES_LIMIT } from "@/lib/storage/hint";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { RecentActivity } from "./profile/RecentActivity";
import { TipCard } from "./profile/TipCard";
import type { Tip } from "@/lib/overview";
import { plural } from "@/lib/typography";
import { hasReadableManual } from "@/lib/cars";

/** Local, login-free profile: car selection and the personal notebook. */
export function ProfileView({
  cars,
  tips,
  tipSeed,
}: {
  cars: CarSummary[];
  tips: Tip[];
  tipSeed: number;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const data = useAppData();
  const hydrated = useHydrated();
  // Until the browser data is read, the layout hint (cookie) stands in for it
  // so the first paint already has the final layout.
  const hint = useLayoutHint();
  const { settings } = data;
  const ownedIds = hydrated ? settings.ownedCars : hint.ownedCars;
  const activeId = hydrated ? settings.activeCar : hint.activeCar;
  const myCars = cars.filter((car) => ownedIds.includes(car.id));
  const active = myCars.find((c) => c.id === activeId) ?? null;
  const highlights = Object.values(data.highlights);
  const pages = [...data.notebook.pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, PROFILE_NOTES_LIMIT);
  const name = hydrated ? settings.profileName.trim() : hint.name;
  const hasManuals = hasReadableManual(cars);
  const counts = hydrated
    ? [
        highlights.length,
        highlights.filter((h) => h.comment.trim()).length,
        data.bookmarks.length,
        data.notebook.pages.length,
      ]
    : hint.counts;
  const noteCount = counts[3];
  const lastReadCar = hydrated ? data.lastRead?.car : hint.lastRead?.car;

  const stats = [
    { label: "Zaznaczenia", value: counts[0], href: "/komentarze" },
    { label: "Komentarze", value: counts[1], href: "/komentarze" },
    { label: "Zakładki", value: counts[2], href: "/zakladki" },
    { label: "Kartki w notatniku", value: counts[3], href: "/notatnik" },
  ];

  return (
    <>
      <section className="flex flex-col gap-5 border-b-2 border-red pb-6 sm:flex-row sm:items-center">
        <div
          aria-hidden="true"
          className="silver-bar flex h-20 w-20 shrink-0 items-center justify-center border border-silver text-3xl font-semibold text-graphite"
        >
          {name ? name[0].toUpperCase() : "★"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {name ? `Cześć, ${name}` : "Twój profil"}
            </h1>
            <button
              type="button"
              className="btn btn-ghost h-9 w-9 justify-center p-0"
              aria-label="Edytuj imię"
              title="Edytuj imię"
              onClick={() => {
                setDraftName(settings.profileName);
                setEditingName(true);
              }}
            >
              <svg
                viewBox="0 0 20 20"
                width="18"
                height="18"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m12.8 3.2 4 4M3 17l3.8-.8L16.3 6.7a1.8 1.8 0 0 0-2.5-2.5L4.3 13.7 3 17Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {editingName && (
            <form
              className="mt-3 flex max-w-md flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                updateData((d) => ({
                  ...d,
                  settings: {
                    ...d.settings,
                    profileName: draftName.slice(0, 80),
                  },
                }));
                setEditingName(false);
              }}
            >
              <label className="min-w-48 flex-1 text-sm text-graphite">
                <span className="mb-1 block">
                  Jak mamy się do Ciebie zwracać?
                </span>
                <input
                  autoFocus
                  className="field h-9"
                  placeholder="Wpisz imię"
                  maxLength={80}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
              </label>
              <button type="submit" className="btn btn-primary h-9">
                Zapisz
              </button>
              <button
                type="button"
                className="btn h-9"
                onClick={() => setEditingName(false)}
              >
                Anuluj
              </button>
            </form>
          )}
        </div>
      </section>

      <p className="mt-4 text-sm text-graphite">
        {!hasManuals
          ? "Nie dodano jeszcze żadnych instrukcji. Dodaj pierwsze auto z plików PDF, aby rozpocząć czytanie."
          : myCars.length === 0
            ? "Dodaj auto do swojego profilu, wybierając je z dostępnych instrukcji albo dodając własne. Twoje ustawienia zostają na tym urządzeniu."
            : "Nie musisz zakładać konta ani się logować. Twoje zaznaczenia, komentarze, notatki i ustawienia zostają tylko na tym urządzeniu. Wybierz auto, a jego instrukcje zapiszą się tak, by działały także bez internetu."}
      </p>

      <section
        aria-label="Co chcesz zrobić?"
        className="mt-6 grid gap-4 md:grid-cols-2"
      >
        {hasManuals && (
          <a href="#auta" className="panel hover-tile group block">
            <div className="panel-title">Wybór auta</div>
            <div className="p-5">
              <h2 className="text-xl font-semibold group-hover:text-red">
                {active ? active.label : "Wybierz auto"}
              </h2>
              <p className="mt-1 text-sm text-graphite">
                {active
                  ? `Wybrane auto · ${active.books.length} ${plural(active.books.length, "instrukcja", "instrukcje", "instrukcji")}. Zmień albo dodaj własne poniżej.`
                  : `Liczba Twoich aut: ${myCars.length}. Możesz dodać kolejne z dostępnych instrukcji.`}
              </p>
            </div>
          </a>
        )}
        <Link href="/notatnik" className="panel hover-tile group block">
          <div className="panel-title">Własny notatnik</div>
          <div className="p-5">
            <h2 className="text-xl font-semibold group-hover:text-red">
              Notatnik
            </h2>
            <p className="mt-1 text-sm text-graphite">
              {`${noteCount} ${plural(noteCount, "kartka", "kartki", "kartek")} · `}
              Puste kartki na własne notatki. Możesz używać nagłówków,
              pogrubienia, list i zadań.
            </p>
          </div>
        </Link>
      </section>

      {hasManuals && (
        <div className="mt-6">
          <ContinueReading
            carLabel={lastReadCar ? carName(cars, lastReadCar) : undefined}
          />
        </div>
      )}

      {hasManuals && (
        <div className="mt-6 space-y-6">
          <RecentActivity cars={cars} />
          <TipCard tips={tips} cars={cars} seed={tipSeed} />
        </div>
      )}

      <section id="auta" className="mt-8 scroll-mt-28">
        <h2 className="mb-3 text-xs font-semibold tracking-[0.08em] text-graphite uppercase">
          Twoje auta
        </h2>
        <CarPicker cars={cars} ownedCarIds={myCars.map((car) => car.id)} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-[0.08em] text-graphite uppercase">
            Ostatnie notatki
          </h2>
          <Link href="/notatnik" className="text-sm text-red hover:underline">
            Otwórz notatnik ›
          </Link>
        </div>
        {!hydrated && noteCount > 0 ? (
          <ul
            className="grid gap-4 md:grid-cols-3"
            aria-busy="true"
            aria-label="Wczytywanie notatek"
          >
            {Array.from(
              { length: Math.min(noteCount, PROFILE_NOTES_LIMIT) },
              (_, i) => (
                <li key={i} className="panel flex flex-col">
                  <div className="panel-title">
                    <Skeleton className="w-2/3" />
                  </div>
                  <div className="h-40 space-y-1 overflow-hidden px-4 py-3 text-sm">
                    <Skeleton className="w-full" />
                    <Skeleton className="w-5/6" />
                    <Skeleton className="w-2/3" />
                  </div>
                  <p className="mt-auto border-t border-line px-4 py-1.5 text-xs">
                    <Skeleton className="w-1/2" />
                  </p>
                </li>
              ),
            )}
          </ul>
        ) : pages.length === 0 ? (
          <div className="panel p-5 text-sm text-steel">
            Notatnik jest pusty.{" "}
            <Link href="/notatnik" className="text-red underline">
              Utwórz pierwszą kartkę
            </Link>
            .
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {pages.map((p) => (
              <li key={p.id} className="panel flex flex-col">
                <Link
                  href={`/notatnik?kartka=${encodeURIComponent(p.id)}`}
                  className="panel-title truncate hover:text-red"
                >
                  {p.title || "Bez tytułu"}
                </Link>
                <div className="relative h-40 overflow-hidden px-4 py-3 text-sm">
                  {p.body.trim() ? (
                    <Markdown source={p.body} />
                  ) : (
                    <p className="text-steel">Pusta kartka.</p>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-white" />
                </div>
                <p className="mt-auto border-t border-line px-4 py-1.5 text-xs text-steel">
                  {new Date(p.updatedAt).toLocaleString("pl-PL")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group bg-white p-4 hover:bg-paper"
          >
            <span className="block text-2xl font-semibold group-hover:text-red">
              {s.value}
            </span>
            <span className="text-xs text-graphite">{s.label}</span>
          </Link>
        ))}
      </section>

      <p className="mt-8 text-xs text-steel">
        Pamiętaj, aby co jakiś czas pobrać kopię zapasową w{" "}
        <Link href="/ustawienia" className="underline">
          Ustawieniach
        </Link>{" "}
        – wyczyszczenie historii przeglądarki usuwa notatki.
      </p>
    </>
  );
}

/** Polish plural form for `n` (1 kartka, 2 kartki, 5 kartek). */
