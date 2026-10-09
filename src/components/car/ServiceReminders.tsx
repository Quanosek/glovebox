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
import { useLayoutHint } from "@/lib/storage/hintContext";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { fixedReminderId } from "@/lib/storage/schema";

/**
 * Car page tile: inspection and OC insurance, plus the nearest own reminder
 * once the owner has added one. Editing happens on `/przypomnienia`.
 */
export function ServiceReminders({
  carId,
  serviceHref,
}: {
  carId: string;
  serviceHref: string | null;
}) {
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const { reminders } = useAppData();
  const today = todayIso();
  const own = reminders.filter((r) => r.car === carId);
  const custom = own.filter((r) => r.kind === "custom");
  const next =
    sortReminders(custom.filter((r) => !r.done))[0] ?? sortReminders(custom)[0];
  // Before hydration the hint tells whether the car has own reminders.
  const hasCustom = hydrated
    ? next !== undefined
    : (hint.reminders[carId] ?? 0) > 0;
  const rows: {
    label: string;
    date: string | null;
    empty: boolean;
    km?: number | null;
    done?: boolean;
  }[] = FIXED_REMINDERS.map((f) => {
    const r = own.find((x) => x.id === fixedReminderId(f.kind, carId));
    return { label: f.title, date: r?.dueDate ?? null, empty: !r };
  });
  if (hasCustom)
    rows.push({
      label: next?.title ?? "",
      date: next?.dueDate ?? null,
      empty: false,
      km: next?.dueKm ?? null,
      done: next?.done,
    });

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
                ) : row.done ? (
                  "wykonane"
                ) : row.date ? (
                  formatDate(row.date)
                ) : row.km != null ? (
                  `przy ${row.km.toLocaleString("pl-PL")} km`
                ) : row.empty ? (
                  "nie ustawiono"
                ) : (
                  "bez terminu"
                )}
              </p>
            </div>
            {hydrated && row.date && !row.done && (
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
