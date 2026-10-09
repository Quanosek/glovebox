"use client";

import Link from "next/link";
import { Skeleton } from "../Skeleton";
import { DueBadge } from "../reminders/DueBadge";
import {
  FIXED_REMINDERS,
  daysUntil,
  formatDate,
  sortReminders,
  todayIso,
} from "@/lib/reminders";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { fixedReminderId } from "@/lib/storage/schema";

/**
 * Car page tile: inspection, OC insurance and the nearest own reminder of the
 * car. Editing happens on `/przypomnienia`.
 */
export function ServiceReminders({
  carId,
  serviceHref,
}: {
  carId: string;
  serviceHref: string | null;
}) {
  const hydrated = useHydrated();
  const { reminders } = useAppData();
  const today = todayIso();
  const own = reminders.filter((r) => r.car === carId);
  const next = sortReminders(
    own.filter((r) => r.kind === "custom" && !r.done),
  )[0];
  const rows = [
    ...FIXED_REMINDERS.map((f) => {
      const r = own.find((x) => x.id === fixedReminderId(f.kind, carId));
      return { label: f.title, date: r?.dueDate ?? null, empty: !r };
    }),
    {
      label: next ? next.title : "Inne przypomnienia",
      date: next?.dueDate ?? null,
      empty: !next,
      km: next?.dueKm ?? null,
    },
  ];

  return (
    <section className="panel" aria-labelledby="reminders-title">
      <h2 id="reminders-title" className="panel-title">
        Przypomnienia
      </h2>
      <ul className="divide-y divide-line">
        {rows.map((row, i) => (
          <li key={i} className="flex h-16 items-center gap-3 px-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {hydrated || i < FIXED_REMINDERS.length ? (
                  row.label
                ) : (
                  <Skeleton className="w-36" />
                )}
              </p>
              <p className="truncate text-sm text-graphite">
                {!hydrated ? (
                  <Skeleton className="w-28" />
                ) : row.date ? (
                  formatDate(row.date)
                ) : "km" in row && row.km != null ? (
                  `przy ${row.km.toLocaleString("pl-PL")} km`
                ) : row.empty ? (
                  "nie ustawiono"
                ) : (
                  "bez terminu"
                )}
              </p>
            </div>
            {hydrated && row.date && (
              <DueBadge days={daysUntil(row.date, today)} />
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line p-4">
        <Link href={`/przypomnienia#${carId}`} className="btn">
          Ustaw przypomnienia ›
        </Link>
        {serviceHref && (
          <Link href={serviceHref} className="text-red hover:underline">
            Przeglądy w instrukcji ›
          </Link>
        )}
      </div>
    </section>
  );
}
