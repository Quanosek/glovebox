"use client";

import Link from "next/link";
import { FAVORITES_LIMIT } from "@/lib/storage/schema";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { toggleFavorite, useAppData, useHydrated } from "@/lib/storage/hooks";
import { Skeleton } from "../Skeleton";

/**
 * "Ulubione": up to six pinned bookmarks of one car, shown as numbered keys
 * like the favourites bar along the bottom of the Navi 950 screen.
 */
export function FavoritesBar({ carId }: { carId: string }) {
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const { bookmarks, settings } = useAppData();
  const own = bookmarks.filter((b) => b.car === carId);
  const pinnedIds = settings.favorites[carId] ?? [];
  const pinned = pinnedIds
    .map((id) => own.find((b) => b.id === id))
    .filter((b) => b !== undefined);
  const free = own.filter((b) => !pinnedIds.includes(b.id));
  // Before hydration the hint tells how many keys are taken.
  const taken = hydrated ? pinned.length : (hint.favorites[carId] ?? 0);

  return (
    <section aria-labelledby="fav-title">
      <div className="mb-2 flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id="fav-title" className="section-label mb-0">
            Ulubione
          </h2>
          <p className="text-sm text-graphite">
            W instrukcji wybierz „Dodaj zakładkę”, a potem przypnij ją tutaj.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-graphite">
          <span className="sr-only sm:not-sr-only">Przypnij:</span>
          <select
            className="field h-9 w-auto max-w-64 py-1 text-sm"
            value=""
            disabled={
              !hydrated ||
              free.length === 0 ||
              pinned.length >= FAVORITES_LIMIT
            }
            onChange={(e) => {
              if (e.target.value) toggleFavorite(carId, e.target.value);
            }}
          >
            <option value="">
              {hydrated && free.length === 0
                ? "Brak zakładek do przypięcia"
                : "Wybierz zakładkę…"}
            </option>
            {free.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol className="fav-bar" aria-busy={hydrated ? undefined : true}>
        {Array.from({ length: FAVORITES_LIMIT }, (_, i) => {
          const b = hydrated ? pinned[i] : undefined;
          if (!hydrated && i < taken)
            return (
              <li key={`hint-${i}`} className="fav-key fav-key-on">
                <span className="fav-num" aria-hidden="true">
                  {i + 1}
                </span>
                <Skeleton className="h-4 flex-1" />
              </li>
            );
          return b ? (
            <li key={b.id} className="fav-key fav-key-on group">
              <span className="fav-num" aria-hidden="true">
                {i + 1}
              </span>
              <Link
                href={b.href}
                className="min-w-0 flex-1 truncate font-semibold group-hover:text-red"
                title={b.title}
              >
                {b.title}
              </Link>
              <button
                type="button"
                className="fav-remove"
                aria-label={`Odepnij: ${b.title}`}
                title="Odepnij"
                onClick={() => toggleFavorite(carId, b.id)}
              >
                ×
              </button>
            </li>
          ) : (
            <li key={`free-${i}`} className="fav-key text-silver">
              <span className="fav-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="text-xs">wolne</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
