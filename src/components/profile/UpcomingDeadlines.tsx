"use client";

import Link from "next/link";
import type { CarSummary } from "@/lib/cars";
import {
  FIXED_REMINDERS,
  daysUntil,
  formatDate,
  todayIso,
} from "@/lib/reminders";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { fixedReminderId } from "@/lib/storage/schema";
import { Skeleton } from "../Skeleton";
import { DueBadge } from "../reminders/DueBadge";

/** Rows shown at most (two cars × inspection and OC). */
const MAX_ROWS = 4;

/**
 * "Najbliższe terminy" on the profile: inspection and OC insurance of the
 * profile's cars, nearest date first. The row count depends only on the owned
 * cars (known from the layout hint), so the first paint has the final size.
 */
export function UpcomingDeadlines({ cars }: { cars: CarSummary[] }) {
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const { reminders, settings } = useAppData();
  const owned = hydrated ? settings.ownedCars : hint.ownedCars;
  const myCars = cars.filter((c) => owned.includes(c.id));
  const today = todayIso();

  const rows = myCars
    .flatMap((car) =>
      FIXED_REMINDERS.map((f) => {
        const r = reminders.find(
          (x) => x.id === fixedReminderId(f.kind, car.id),
        );
        return {
          key: `${f.kind}:${car.id}`,
          car,
          title: f.title,
          date: r && !r.done ? r.dueDate : null,
        };
      }),
    )
    .sort((a, b) =>
      (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99"),
    )
    .slice(0, MAX_ROWS);

  return (
    <section className="panel flex flex-col" aria-labelledby="deadlines-title">
      <h2 id="deadlines-title" className="panel-title">
        Najbliższe terminy
      </h2>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              href={`/przypomnienia#${row.car.id}`}
              className="hover-row group flex items-center gap-3 px-4 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold group-hover:text-red">
                  {row.title}
                </span>
                <span className="block truncate text-xs text-steel">
                  {row.car.brand} {row.car.model} ·{" "}
                  {!hydrated ? (
                    <Skeleton className="inline-block w-24 align-middle" />
                  ) : row.date ? (
                    formatDate(row.date)
                  ) : (
                    "nie ustawiono"
                  )}
                </span>
              </span>
              {hydrated && row.date && (
                <DueBadge days={daysUntil(row.date, today)} />
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-line px-4 py-2 text-right text-sm">
        <Link href="/przypomnienia" className="text-red hover:underline">
          Wszystkie przypomnienia ›
        </Link>
      </div>
    </section>
  );
}
