"use client";

import { useState, type FormEvent } from "react";
import { confirmDialog } from "../Dialog";
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
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [km, setKm] = useState("");
  const today = todayIso();
  const own = reminders ? sortReminders(reminders) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kmValue = km.replace(/\s/g, "");
    saveReminder({
      car: carId,
      kind: "custom",
      title: title.trim(),
      dueDate: date || null,
      dueKm: kmValue ? Math.max(0, Math.round(Number(kmValue))) : null,
      done: false,
    });
    setTitle("");
    setDate("");
    setKm("");
    setAdding(false);
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
      {rows.length === 0 && !adding ? (
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
                    <Skeleton className="my-0.5 h-5 w-48 max-w-full" />
                    <Skeleton className="mt-1 h-4 w-32" />
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

      {adding ? (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-graphite">
              Co trzeba zrobić?
            </span>
            <input
              className="field"
              list={`reminder-suggestions-${carId}`}
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Przegląd okresowy"
              autoFocus
            />
            <datalist id={`reminder-suggestions-${carId}`}>
              {REMINDER_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-graphite">
              Termin (opcjonalnie)
            </span>
            <input
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-semibold text-graphite">
              Przebieg w km (opcjonalnie)
            </span>
            <input
              className="field"
              inputMode="numeric"
              pattern="[0-9 ]*"
              maxLength={9}
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="np. 120 000"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim()}
            >
              Zapisz przypomnienie
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setAdding(false)}
            >
              Anuluj
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="btn mt-4"
          disabled={!own}
          onClick={() => setAdding(true)}
        >
          + Dodaj przypomnienie
        </button>
      )}
    </div>
  );
}
