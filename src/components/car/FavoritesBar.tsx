"use client";

import Link from "next/link";
import { FAVORITES_LIMIT } from "@/lib/storage/schema";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { plural } from "@/lib/typography";
import { Skeleton } from "../Skeleton";

/**
 * "Ulubione": the newest bookmarks of one car (at most six), shown as
 * numbered keys like the favourites bar along the bottom of the Navi 950
 * screen. Bookmarks are added in the manual; the bar only shows them and is
 * hidden while the car has none.
 */
export function FavoritesBar({ carId }: { carId: string }) {
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const { bookmarks } = useAppData();
  const own = bookmarks.filter((b) => b.car === carId).reverse();
  // Before hydration the hint tells how many keys are taken.
  const shown = hydrated
    ? Math.min(own.length, FAVORITES_LIMIT)
    : (hint.bookmarks[carId] ?? 0);
  if (shown === 0) return null;

  return (
    <section aria-labelledby="fav-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="fav-title" className="section-label mb-0">
          Ulubione
        </h2>
        <Link href="/zakladki" className="text-sm text-graphite hover:text-red">
          {hydrated && own.length > FAVORITES_LIMIT
            ? `Wszystkie zakładki (${own.length}) ›`
            : "Wszystkie zakładki ›"}
        </Link>
      </div>
      <ol className="fav-bar" aria-busy={hydrated ? undefined : true}>
        {Array.from({ length: FAVORITES_LIMIT }, (_, i) => {
          const b = hydrated ? own[i] : undefined;
          if (!hydrated && i < shown)
            return (
              <li key={`hint-${i}`} className="fav-key fav-key-on">
                <span className="fav-num" aria-hidden="true">
                  {i + 1}
                </span>
                <Skeleton className="flex-1" />
              </li>
            );
          return b ? (
            <li key={b.id}>
              <Link
                href={b.href}
                className="fav-key fav-key-on group h-full"
                title={b.title}
              >
                <span className="fav-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold group-hover:text-red">
                  {b.title}
                </span>
              </Link>
            </li>
          ) : (
            <li key={`free-${i}`} className="fav-key" aria-hidden="true">
              <span className="fav-num">{i + 1}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm text-steel">
        {shown < FAVORITES_LIMIT
          ? `Jeszcze ${FAVORITES_LIMIT - shown} ${plural(FAVORITES_LIMIT - shown, "miejsce", "miejsca", "miejsc")} – w instrukcji wybierz „Dodaj zakładkę”.`
          : "Pokazujemy sześć najnowszych zakładek tego auta."}
      </p>
    </section>
  );
}
