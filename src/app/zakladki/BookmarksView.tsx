"use client";

import Link from "next/link";
import { bookName, carName, type CarSummary } from "@/lib/cars";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";
import { Skeleton } from "@/components/Skeleton";

export function BookmarksView({ cars }: { cars: CarSummary[] }) {
  const { bookmarks } = useAppData();
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
          <button
            type="button"
            className="btn h-7 py-0"
            onClick={() =>
              updateData((d) => ({
                ...d,
                bookmarks: d.bookmarks.filter((x) => x.id !== b.id),
              }))
            }
          >
            Usuń
          </button>
        </li>
      ))}
    </ul>
  );
}
