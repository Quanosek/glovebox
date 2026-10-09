"use client";

import MiniSearch, { type SearchResult } from "minisearch";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SearchDoc } from "@/lib/content";
import { getAvailability } from "@/lib/availability";
import { excerpt, normalizeText } from "@/lib/search";
import { polishTypography as typo } from "@/lib/typography";
import {
  useAppData,
  useHydrated,
  useVehicleProfile,
} from "@/lib/storage/hooks";

export interface SearchCar {
  id: string;
  label: string;
  books: { id: string; short: string }[];
}

/**
 * Rendered inside a Suspense boundary, which hydrates after the page-wide
 * typography pass (`watchTypography`) has run: server-rendered text applies
 * the same Polish line-breaking rules itself so both renders match.
 */
export function SearchView({ cars }: { cars: SearchCar[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [loaded, setLoaded] = useState<{
    car: string;
    docs: SearchDoc[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<string>("all");
  const hydrated = useHydrated();
  const { settings } = useAppData();

  // Car: ?car=, otherwise the active car of the profile, otherwise the first.
  const [chosenCar, setChosenCar] = useState<string | null>(null);
  const paramCar = params.get("car");
  const carId =
    [chosenCar, paramCar, hydrated ? settings.activeCar : null].find(
      (id) => id && cars.some((c) => c.id === id),
    ) ??
    cars[0]?.id ??
    null;
  const car = cars.find((c) => c.id === carId) ?? null;
  const profile = useVehicleProfile(carId);
  const docs = loaded && loaded.car === carId ? loaded.docs : null;

  // Sync with the header search box (?q=).
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setQuery(initial);
  }

  useEffect(() => {
    if (!carId || !hydrated) return;
    let cancelled = false;
    fetch(`/api/search-index?car=${encodeURIComponent(carId)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Nie udało się przygotować wyszukiwania.");
        return r.json() as Promise<SearchDoc[]>;
      })
      .then((d) => {
        if (cancelled) return;
        setError(null);
        setLoaded({ car: carId, docs: d });
      })
      .catch(() => {
        if (!cancelled) setError("Nie udało się przygotować wyszukiwania.");
      });
    return () => {
      cancelled = true;
    };
  }, [carId, hydrated]);

  const engine = useMemo(() => {
    if (!docs) return null;
    const ms = new MiniSearch<SearchDoc>({
      fields: ["title", "path", "text"],
      storeFields: ["id"],
      processTerm: (term) => normalizeText(term) || null,
      searchOptions: {
        prefix: true,
        fuzzy: 0.15,
        boost: { title: 4, path: 1.5 },
        combineWith: "AND",
      },
    });
    ms.addAll(docs);
    return ms;
  }, [docs]);

  const byId = useMemo(
    () => new Map((docs ?? []).map((d) => [d.id, d])),
    [docs],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!engine || q.length < 2) return [];
    return engine
      .search(q)
      .map((r: SearchResult) => ({ result: r, doc: byId.get(r.id as string)! }))
      .filter(({ doc }) => doc && (book === "all" || doc.book === book))
      .slice(0, 100);
  }, [engine, byId, query, book]);

  const queryTerms = normalizeText(query)
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = `q=${encodeURIComponent(query.trim())}`;
    router.replace(`/szukaj?${q}${carId ? `&car=${carId}` : ""}`);
  };

  return (
    <div className="mt-4">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 sm:flex-row"
        role="search"
      >
        <input
          type="search"
          className="field"
          placeholder="np. ciśnienie w oponach, tempomat, dach"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukane słowa"
        />
        {cars.length > 1 && (
          <select
            className="field sm:w-56"
            value={carId ?? ""}
            onChange={(e) => {
              setChosenCar(e.target.value);
              setBook("all");
            }}
            aria-label="Auto"
          >
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {typo(c.label)}
              </option>
            ))}
          </select>
        )}
        <select
          className="field sm:w-56"
          value={book}
          onChange={(e) => setBook(e.target.value)}
          aria-label="Instrukcja"
        >
          <option value="all">Wszystkie instrukcje</option>
          {car?.books.map((b) => (
            <option key={b.id} value={b.id}>
              {typo(b.short)}
            </option>
          ))}
        </select>
      </form>
      <p className="mt-2 text-xs text-steel">
        {typo(
          "Wielkość liter i polskie znaki nie mają znaczenia (np. „swiatla” znajdzie „światła”).",
        )}
      </p>

      {error && (
        <p className="mt-4 text-red">
          Nie udało się przygotować wyszukiwania: {error}
        </p>
      )}
      {!car && (
        <p className="mt-4 text-steel">
          {typo("Brak aut – dodaj auto na stronie „Dodaj auto”.")}
        </p>
      )}
      {car && !docs && !error && (
        <p className="mt-4 text-steel">Przygotowywanie wyszukiwania…</p>
      )}

      {docs && query.trim().length >= 2 && (
        <p className="mt-6 text-sm text-graphite">
          Wyniki: <strong>{results.length}</strong>
        </p>
      )}

      <ul className="mt-2 border-t border-line">
        {results.map(({ result, doc }) => {
          const missing =
            hydrated &&
            getAvailability(doc.features, profile).kind === "missing";
          if (missing && !settings.showUnavailable && results.length > 1) {
            return (
              <li
                key={doc.id}
                className="border-b border-line px-3 py-2 text-sm text-steel"
              >
                <Link href={doc.href} className="hover:text-red">
                  {doc.title}
                </Link>{" "}
                <span className="badge badge-red ml-1">Brak w Twoim aucie</span>
              </li>
            );
          }
          return (
            <li key={doc.id} className="border-b border-line">
              <Link href={doc.href} className="block px-3 py-3 hover:bg-paper">
                <span className="block text-xs text-steel">
                  {doc.bookTitle}
                  {doc.path ? ` › ${doc.path}` : ""}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 font-semibold">
                  <Marked
                    text={doc.title}
                    terms={[...result.terms, ...queryTerms]}
                  />
                  {missing && (
                    <span className="badge badge-red">Brak w Twoim aucie</span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-graphite">
                  <Marked
                    text={excerpt(doc.text, result.terms)}
                    terms={[...result.terms, ...queryTerms]}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Marks normalized term occurrences in `text`. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const norm = normalizeText(text);
  if (norm.length !== text.length || terms.length === 0) return <>{text}</>;
  const marks: [number, number][] = [];
  for (const t of terms) {
    let i = norm.indexOf(t);
    while (t && i >= 0) {
      marks.push([i, i + t.length]);
      i = norm.indexOf(t, i + t.length);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  for (const [s, e] of marks) {
    if (s < pos) continue;
    out.push(text.slice(pos, s));
    out.push(
      <mark key={s} className="bg-transparent font-semibold text-red">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  }
  out.push(text.slice(pos));
  return <>{out}</>;
}
