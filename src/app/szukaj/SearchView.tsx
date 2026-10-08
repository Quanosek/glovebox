"use client";

import MiniSearch, { type SearchResult } from "minisearch";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SearchDoc } from "@/lib/content";
import { getAvailability } from "@/lib/availability";
import { excerpt, normalizeText } from "@/lib/search";
import {
  useAppData,
  useHydrated,
  useVehicleProfile,
} from "@/lib/storage/hooks";

type BookFilter = "all" | "manual" | "infotainment";

export function SearchView() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<BookFilter>("all");
  const profile = useVehicleProfile();
  const hydrated = useHydrated();
  const { settings } = useAppData();

  // Sync with the header search box (?q=).
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setQuery(initial);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/search-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SearchDoc[]>;
      })
      .then((d) => !cancelled && setDocs(d))
      .catch(
        (e: unknown) =>
          !cancelled && setError(e instanceof Error ? e.message : String(e)),
      );
    return () => {
      cancelled = true;
    };
  }, []);

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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.replace(`/szukaj?q=${encodeURIComponent(query.trim())}`);
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
          aria-label="Szukana fraza"
        />
        <select
          className="field sm:w-56"
          value={book}
          onChange={(e) => setBook(e.target.value as BookFilter)}
          aria-label="Księga"
        >
          <option value="all">Obie księgi</option>
          <option value="manual">Instrukcja obsługi</option>
          <option value="infotainment">Navi 950</option>
        </select>
      </form>
      <p className="mt-2 text-xs text-steel">
        Wielkość liter i polskie znaki nie mają znaczenia (np. „swiatla”
        znajdzie „światła”).
      </p>

      {error && (
        <p className="mt-4 text-red">
          Nie udało się wczytać indeksu wyszukiwania: {error}
        </p>
      )}
      {!docs && !error && (
        <p className="mt-4 text-steel">Wczytywanie indeksu…</p>
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
                  <Marked text={doc.title} terms={result.terms} />
                  {missing && (
                    <span className="badge badge-red">Brak w Twoim aucie</span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-graphite">
                  <Marked
                    text={excerpt(doc.text, result.terms)}
                    terms={result.terms}
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
