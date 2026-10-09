"use client";

import Link from "next/link";
import { FAVORITES_LIMIT } from "@/lib/storage/schema";
import {
  toggleFavorite,
  useAppData,
  useHydrated,
} from "@/lib/storage/hooks";
import { Skeleton } from "../Skeleton";

/**
 * "Ulubione": up to six pinned bookmarks of one car, shown as numbered keys
 * like the favourites bar along the bottom of the Navi 950 screen.
 */
export function FavoritesBar({ carId }: { carId: string }) {
  const hydrated = useHydrated();
  const { bookmarks, settings } = useAppData();
  if (!hydrated)
    return (
      <div className="fav-bar" aria-busy="true">
        {Array.from({ length: FAVORITES_LIMIT }, (_, i) => (
          <div key={i} className="fav-key">
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );

  const own = bookmarks.filter((b) => b.car === carId);
  const pinnedIds = settings.favorites[carId] ?? [];
  const pinned = pinnedIds
    .map((id) => own.find((b) => b.id === id))
    .filter((b) => b !== undefined);
  const free = own.filter((b) => !pinnedIds.includes(b.id));

  return (
    <section aria-labelledby="fav-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fav-title" className="section-label mb-0">
          Ulubione
        </h2>
        {free.length > 0 && pinned.length < FAVORITES_LIMIT && (
          <label className="flex items-center gap-2 text-sm text-graphite">
            <span className="sr-only sm:not-sr-only">Przypnij:</span>
            <select
              className="field h-9 w-auto max-w-64 py-1 text-sm"
              value=""
              onChange={(e) => {
                if (e.target.value) toggleFavorite(carId, e.target.value);
              }}
            >
              <option value="">Wybierz zakładkę…</option>
              {free.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {own.length === 0 ? (
        <p className="border border-dashed border-silver bg-white px-4 py-3 text-sm text-graphite">
          Tu pojawią się Twoje ulubione rozdziały. W instrukcji wybierz „Dodaj
          zakładkę”, a potem przypnij ją tutaj.
        </p>
      ) : (
        <ol className="fav-bar">
          {Array.from({ length: FAVORITES_LIMIT }, (_, i) => {
            const b = pinned[i];
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
      )}
    </section>
  );
}
