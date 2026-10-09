"use client";

import Link from "next/link";
import { bookName, carName, type CarSummary } from "@/lib/cars";
import {
  toggleFavorite,
  updateData,
  useAppData,
  useHydrated,
  withoutBookmark,
} from "@/lib/storage/hooks";
import { FAVORITES_LIMIT } from "@/lib/storage/schema";
import { Skeleton } from "@/components/Skeleton";

export function BookmarksView({ cars }: { cars: CarSummary[] }) {
  const { bookmarks, settings } = useAppData();
  const hydrated = useHydrated();
  if (!hydrated)
    return (
      <ul className="mt-4 border-t border-line" aria-busy="true">
        {[0, 1, 2, 3].map((item) => (
          <li
            key={item}
            className="flex min-h-16 items-center gap-3 border-b border-line px-3 py-2"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-7 w-14 shrink-0" />
          </li>
        ))}
      </ul>
    );
  if (bookmarks.length === 0) {
    return (
      <p className="mt-6 text-steel">
        Brak zakładek. Użyj przycisku „Dodaj zakładkę” na stronie dowolnej
        sekcji instrukcji.
      </p>
    );
  }

  const sorted = [...bookmarks].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <ul className="mt-4 border-t border-line">
      {sorted.map((b) => (
        <li
          key={b.id}
          className="flex items-center gap-3 border-b border-line px-3 py-2"
        >
          <Link href={b.href} className="flex-1 hover:text-red">
            <span className="block">{b.title}</span>
            <span className="block text-xs text-steel">
              {carName(cars, b.car)} · {bookName(cars, b.car, b.book)} · dodano{" "}
              {new Date(b.createdAt).toLocaleDateString("pl-PL")}
            </span>
          </Link>
          <FavoriteToggle
            car={b.car}
            id={b.id}
            pinned={settings.favorites[b.car] ?? []}
          />
          <button
            type="button"
            className="btn h-7 py-0"
            onClick={() => updateData((d) => withoutBookmark(d, b.id))}
          >
            Usuń
          </button>
        </li>
      ))}
    </ul>
  );
}

function FavoriteToggle({
  car,
  id,
  pinned,
}: {
  car: string;
  id: string;
  pinned: string[];
}) {
  const on = pinned.includes(id);
  const full = !on && pinned.length >= FAVORITES_LIMIT;
  return (
    <button
      type="button"
      className={`btn h-7 py-0 ${on ? "btn-pressed" : ""}`}
      aria-pressed={on}
      disabled={full}
      title={
        full
          ? `Na pasku ulubionych jest już ${FAVORITES_LIMIT} pozycji`
          : "Pokaż na pasku ulubionych na stronie auta"
      }
      onClick={() => toggleFavorite(car, id)}
    >
      {on ? "W ulubionych" : "Do ulubionych"}
    </button>
  );
}
