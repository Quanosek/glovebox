"use client";

import Link from "next/link";
import type { CarSummary } from "@/lib/cars";
import { carName } from "@/lib/cars";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";
import { CarPicker } from "./CarPicker";
import { ContinueReading } from "./ContinueReading";
import { Markdown } from "./Markdown";

/** Local, login-free profile: car selection and the personal notebook. */
export function ProfileView({ cars }: { cars: CarSummary[] }) {
  const data = useAppData();
  const hydrated = useHydrated();
  const { settings } = data;
  const active = hydrated
    ? (cars.find((c) => c.id === settings.activeCar) ?? null)
    : null;
  const highlights = Object.values(data.highlights);
  const pages = [...data.notebook.pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
  const name = settings.profileName.trim();

  const stats = [
    { label: "Zaznaczenia", value: highlights.length, href: "/komentarze" },
    {
      label: "Komentarze",
      value: highlights.filter((h) => h.comment.trim()).length,
      href: "/komentarze",
    },
    { label: "Zakładki", value: data.bookmarks.length, href: "/zakladki" },
    {
      label: "Kartki w notatniku",
      value: data.notebook.pages.length,
      href: "/notatnik",
    },
  ];

  return (
    <>
      <section className="flex flex-col gap-5 border-b-2 border-red pb-6 sm:flex-row sm:items-center">
        <div
          aria-hidden="true"
          className="silver-bar flex h-20 w-20 shrink-0 items-center justify-center border border-silver text-3xl font-semibold text-graphite"
        >
          {hydrated && name ? name[0].toUpperCase() : "★"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-[0.12em] text-steel uppercase">
            Profil lokalny · bez logowania
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {hydrated && name ? `Cześć, ${name}` : "Twój profil"}
          </h1>
          <label className="mt-2 flex max-w-sm items-center gap-2 text-sm text-graphite">
            <span className="shrink-0">Nazwa profilu:</span>
            <input
              className="field h-8"
              placeholder="opcjonalnie, np. imię"
              maxLength={80}
              value={hydrated ? settings.profileName : ""}
              disabled={!hydrated}
              onChange={(e) =>
                updateData((d) => ({
                  ...d,
                  settings: { ...d.settings, profileName: e.target.value },
                }))
              }
            />
          </label>
        </div>
      </section>

      <p className="mt-4 text-sm text-graphite">
        Profil działa bez konta i bez bazy danych: zaznaczenia, komentarze,
        notatki i ustawienia są zapisywane tylko w tej przeglądarce. Instrukcje
        aut pochodzą z folderu <code>database/</code> w repozytorium, więc są
        dostępne na każdym urządzeniu, na którym uruchomisz projekt.
      </p>

      <section
        aria-label="Co chcesz zrobić?"
        className="mt-6 grid gap-4 md:grid-cols-2"
      >
        <a href="#auta" className="panel group block hover:border-silver">
          <div className="panel-title">Wybór auta</div>
          <div className="p-5">
            <h2 className="text-xl font-semibold group-hover:text-red">
              {active ? active.label : "Wybierz auto"}
            </h2>
            <p className="mt-1 text-sm text-graphite">
              {active
                ? `Wybrane auto · ${active.books.length} ${active.books.length === 1 ? "instrukcja" : "instrukcje"}. Zmień albo dodaj własne poniżej.`
                : `Dostępne auta: ${cars.length}. Możesz też dodać własne z plików PDF.`}
            </p>
          </div>
        </a>
        <Link
          href="/notatnik"
          className="panel group block hover:border-silver"
        >
          <div className="panel-title">Własny notatnik</div>
          <div className="p-5">
            <h2 className="text-xl font-semibold group-hover:text-red">
              Notatnik
            </h2>
            <p className="mt-1 text-sm text-graphite">
              {hydrated ? `${data.notebook.pages.length} kartek · ` : ""}
              Puste kartki z podstawowym formatowaniem Markdown (nagłówki,
              pogrubienie, listy, zadania).
            </p>
          </div>
        </Link>
      </section>

      <div className="mt-6">
        <ContinueReading
          carLabel={
            hydrated && data.lastRead
              ? carName(cars, data.lastRead.car)
              : undefined
          }
        />
      </div>

      <section id="auta" className="mt-8 scroll-mt-28">
        <h2 className="mb-3 text-xs font-semibold tracking-[0.08em] text-graphite uppercase">
          Twoje auta
        </h2>
        <CarPicker cars={cars} />
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
        {!hydrated ? null : pages.length === 0 ? (
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
                <div className="relative max-h-40 overflow-hidden px-4 py-3 text-sm">
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
              {hydrated ? s.value : "–"}
            </span>
            <span className="text-xs text-graphite">{s.label}</span>
          </Link>
        ))}
      </section>

      <p className="mt-8 text-xs text-steel">
        Pamiętaj o regularnym eksporcie kopii zapasowej w{" "}
        <Link href="/ustawienia" className="underline">
          Ustawieniach
        </Link>{" "}
        — wyczyszczenie danych przeglądarki usuwa notatki.
      </p>
    </>
  );
}
