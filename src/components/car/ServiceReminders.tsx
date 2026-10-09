"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { confirmDialog } from "../Dialog";
import { Skeleton } from "../Skeleton";
import {
  deleteReminder,
  saveReminder,
  useAppData,
  useHydrated,
} from "@/lib/storage/hooks";
import type { Reminder } from "@/lib/storage/schema";
import { plural } from "@/lib/typography";

const SUGGESTIONS = [
  "Przegląd okresowy",
  "Wymiana oleju",
  "Badanie techniczne",
  "Wymiana opon",
  "Ubezpieczenie",
  "Płyn hamulcowy",
];

const DAY = 24 * 60 * 60 * 1000;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysUntil(date: string): number {
  return Math.round(
    (new Date(`${date}T00:00:00`).getTime() -
      new Date(`${today()}T00:00:00`).getTime()) /
      DAY,
  );
}

const sortKey = (r: Reminder) =>
  `${r.done ? 1 : 0}${r.dueDate ?? "9999-99-99"}${String(r.dueKm ?? 9e9).padStart(12, "0")}`;

/** Owner's own service reminders for one car (date and/or mileage). */
export function ServiceReminders({
  carId,
  serviceHref,
}: {
  carId: string;
  serviceHref: string | null;
}) {
  const hydrated = useHydrated();
  const { reminders } = useAppData();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [km, setKm] = useState("");
  const own = reminders
    .filter((r) => r.car === carId)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kmValue = km.replace(/\s/g, "");
    saveReminder({
      car: carId,
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

  return (
    <section className="panel" aria-labelledby="reminders-title">
      <h2 id="reminders-title" className="panel-title">
        Przypomnienia serwisowe
      </h2>
      <div className="p-4 text-sm">
        {!hydrated ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : own.length === 0 && !adding ? (
          <p className="text-graphite">
            Zapisz termin przeglądu, wymiany oleju albo badania technicznego –
            przypomnienie pojawi się tutaj.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {own.map((r) => {
              const days = r.dueDate ? daysUntil(r.dueDate) : null;
              return (
                <li
                  key={r.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${r.done ? "text-steel" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${r.done ? "line-through" : ""}`}>
                      {r.title}
                    </p>
                    <p className="text-xs text-graphite">
                      {[
                        r.dueDate &&
                          new Date(`${r.dueDate}T00:00:00`).toLocaleDateString(
                            "pl-PL",
                            { day: "numeric", month: "long", year: "numeric" },
                          ),
                        r.dueKm != null &&
                          `przy ${r.dueKm.toLocaleString("pl-PL")} km`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "bez terminu"}
                    </p>
                  </div>
                  {!r.done && days != null && (
                    <span
                      className={`badge ${days < 0 ? "badge-red" : days <= 30 ? "badge-dark" : ""}`}
                    >
                      {days < 0
                        ? "termin minął"
                        : days === 0
                          ? "dzisiaj"
                          : `za ${days} ${plural(days, "dzień", "dni", "dni")}`}
                    </span>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={`btn h-8 py-0 ${r.done ? "btn-pressed" : ""}`}
                      aria-pressed={r.done}
                      onClick={() => saveReminder({ ...r, done: !r.done })}
                    >
                      {r.done ? "Zrobione" : "Oznacz jako zrobione"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost h-8 py-0"
                      onClick={() => void remove(r)}
                    >
                      Usuń
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hydrated && adding && (
          <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-graphite">
                Co trzeba zrobić?
              </span>
              <input
                className="field"
                list="reminder-suggestions"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Przegląd okresowy"
                autoFocus
              />
              <datalist id="reminder-suggestions">
                {SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-graphite">
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
              <span className="mb-1 block text-xs font-semibold text-graphite">
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
        )}

        {hydrated && !adding && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              className="btn"
              onClick={() => setAdding(true)}
            >
              + Dodaj przypomnienie
            </button>
            {serviceHref && (
              <Link href={serviceHref} className="text-red hover:underline">
                Przeglądy w instrukcji ›
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
