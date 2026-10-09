"use client";

import { confirmDialog, formDialog } from "../Dialog";
import { Skeleton } from "../Skeleton";
import {
  REMINDER_SUGGESTIONS,
  daysUntil,
  formatDate,
  sortReminders,
  todayIso,
} from "@/lib/reminders";
import { deleteReminder, saveReminder } from "@/lib/storage/hooks";
import type { Reminder } from "@/lib/storage/schema";
import { DueBadge } from "./DueBadge";

/** Owner's own reminders of one car (service, oil, tyres …) with a form. */
export function CustomReminders({
  carId,
  reminders,
  skeletonRows,
}: {
  carId: string;
  /** Null before hydration: `skeletonRows` placeholder rows are shown. */
  reminders: Reminder[] | null;
  skeletonRows: number;
}) {
  const today = todayIso();
  const own = reminders ? sortReminders(reminders) : null;

  const add = async () => {
    const values = await formDialog({
      title: "Nowe przypomnienie",
      fields: [
        {
          name: "title",
          label: "Co trzeba zrobić?",
          placeholder: "np. Przegląd okresowy",
          maxLength: 120,
          required: true,
          suggestions: REMINDER_SUGGESTIONS,
        },
        { name: "date", label: "Termin (opcjonalnie)", type: "date" },
        {
          name: "km",
          label: "Przebieg w km (opcjonalnie)",
          placeholder: "np. 120 000",
          maxLength: 9,
          pattern: "[0-9 ]*",
          inputMode: "numeric",
        },
      ],
      confirmLabel: "Zapisz przypomnienie",
      validate: ({ title, km }) => {
        if (!title.trim()) return "Wpisz, co trzeba zrobić.";
        const kmValue = km.replace(/\s/g, "");
        if (kmValue && Number(kmValue) > 5_000_000)
          return "Przebieg nie może przekraczać 5 000 000 km.";
        return null;
      },
    });
    if (!values) return;
    const kmValue = values.km.replace(/\s/g, "");
    saveReminder({
      car: carId,
      kind: "custom",
      title: values.title.trim(),
      dueDate: values.date || null,
      dueKm: kmValue ? Number(kmValue) : null,
      done: false,
    });
  };

  const remove = async (r: Reminder) => {
    const ok = await confirmDialog({
      title: "Usunąć przypomnienie?",
      message: <p>„{r.title}” zniknie z listy.</p>,
      confirmLabel: "Usuń przypomnienie",
      danger: true,
    });
    if (ok) deleteReminder(r.id);
  };

  const rows = own ?? Array.from({ length: skeletonRows }, () => null);

  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-graphite">
          Dodaj własne terminy, np. przegląd w serwisie, wymianę oleju albo
          opon.
        </p>
      ) : rows.length > 0 ? (
        <ul
          className="divide-y divide-line border-y border-line"
          aria-busy={own ? undefined : true}
        >
          {rows.map((r, i) => {
            if (!r)
              return (
                <li key={i} className="reminder-row">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="w-48 max-w-full" />
                    <Skeleton className="w-32 text-sm" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-9 w-40" />
                    <Skeleton className="h-9 w-16" />
                  </div>
                </li>
              );
            return (
              <li
                key={r.id}
                className={`reminder-row ${r.done ? "text-steel" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-semibold ${r.done ? "line-through" : ""}`}
                  >
                    {r.title}
                  </p>
                  <p className="truncate text-sm text-graphite">
                    {[
                      r.dueDate && formatDate(r.dueDate),
                      r.dueKm != null &&
                        `przy ${r.dueKm.toLocaleString("pl-PL")} km`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "bez terminu"}
                  </p>
                </div>
                {!r.done && r.dueDate && (
                  <DueBadge days={daysUntil(r.dueDate, today)} />
                )}
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`btn h-9 py-0 ${r.done ? "btn-pressed" : ""}`}
                    aria-pressed={r.done}
                    onClick={() => saveReminder({ ...r, done: !r.done })}
                  >
                    {r.done ? "Zrobione" : "Oznacz jako zrobione"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost h-9 py-0"
                    onClick={() => void remove(r)}
                  >
                    Usuń
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <button
        type="button"
        className="btn mt-4"
        disabled={!own}
        onClick={() => void add()}
      >
        + Dodaj przypomnienie
      </button>
    </div>
  );
}
