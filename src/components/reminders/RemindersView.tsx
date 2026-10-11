"use client";

import { useState } from "react";
import Link from "next/link";
import type { CarSummary } from "@/lib/cars";
import {
  FIXED_REMINDERS,
  addYear,
  daysUntil,
  formatDate,
  todayIso,
} from "@/lib/reminders";
import { useLayoutHint } from "@/lib/storage/hintContext";
import {
  deleteReminder,
  saveReminder,
  useAppData,
  useHydrated,
} from "@/lib/storage/hooks";
import { fixedReminderId, type Reminder } from "@/lib/storage/schema";
import { CarLogo } from "../CarLogo";
import { Skeleton } from "../Skeleton";
import { CustomReminders } from "./CustomReminders";
import { DueBadge } from "./DueBadge";
import { ReminderNotifications } from "./ReminderNotifications";
import { ReminderDatePicker } from "./ReminderDatePicker";

/**
 * "Przypomnienia": per car of the profile, the yearly technical inspection,
 * the OC insurance and the owner's own reminders. Everything stays in this
 * browser; nothing is sent anywhere.
 */
export function RemindersView({
  cars,
  serviceHrefs,
}: {
  cars: CarSummary[];
  /** Car id → section about servicing in its manual. */
  serviceHrefs: Record<string, string>;
}) {
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const data = useAppData();
  const owned = hydrated ? data.settings.ownedCars : hint.ownedCars;
  const myCars = cars.filter((c) => owned.includes(c.id));

  if (myCars.length === 0)
    return (
      <div className="panel p-6">
        <p className="type-card">Dodaj auto, aby ustawić terminy</p>
        <p className="mt-2 max-w-2xl text-graphite">
          Każde auto ma tu własną listę: badanie techniczne, OC i Twoje terminy,
          np. wymianę oleju.
        </p>
        <Link href="/dodaj-auto" className="btn btn-primary mt-4">
          Dodaj auto
        </Link>
      </div>
    );

  return (
    <div className="space-y-8">
      {myCars.map((car) => (
        <CarReminders
          key={car.id}
          car={car}
          serviceHref={serviceHrefs[car.id] ?? null}
          reminders={
            hydrated ? data.reminders.filter((r) => r.car === car.id) : null
          }
          skeletonRows={hint.reminders[car.id] ?? 0}
        />
      ))}
      <ReminderNotifications />
    </div>
  );
}

function CarReminders({
  car,
  serviceHref,
  reminders,
  skeletonRows,
}: {
  car: CarSummary;
  serviceHref: string | null;
  reminders: Reminder[] | null;
  skeletonRows: number;
}) {
  return (
    <section
      id={car.id}
      className="panel scroll-mt-32"
      aria-labelledby={`${car.id}-title`}
    >
      <div className="silver-bar flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
        <CarLogo carId={car.id} brand={car.brand} logo={car.logo} size={40} />
        <div className="min-w-0 flex-1">
          <h2 id={`${car.id}-title`} className="type-card">
            {car.brand} {car.model}
          </h2>
          <p className="text-sm text-graphite">
            {[car.year, car.variant].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Link href={car.href} className="text-red hover:underline">
          Strona auta ›
        </Link>
      </div>

      <div className="grid gap-px bg-line md:grid-cols-2">
        {FIXED_REMINDERS.map((f) => {
          const reminder = reminders
            ? (reminders.find(
                (r) => r.id === fixedReminderId(f.kind, car.id),
              ) ?? null)
            : undefined;
          return (
            <DeadlineCard
              key={`${f.kind}-${reminder?.eventDate ?? ""}`}
              carId={car.id}
              kind={f.kind}
              title={f.title}
              text={f.text}
              reminder={reminder}
            />
          );
        })}
      </div>

      <div className="border-t border-line p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="section-label mb-0">Inne przypomnienia</h3>
          {serviceHref && (
            <Link href={serviceHref} className="text-red hover:underline">
              Przeglądy w instrukcji ›
            </Link>
          )}
        </div>
        <CustomReminders
          carId={car.id}
          reminders={
            reminders ? reminders.filter((r) => r.kind === "custom") : null
          }
          skeletonRows={skeletonRows}
        />
      </div>
    </section>
  );
}

/** One fixed yearly deadline: big date, status and a date field. */
function DeadlineCard({
  carId,
  kind,
  title,
  text,
  reminder,
}: {
  carId: string;
  kind: "inspection" | "insurance";
  title: string;
  text: string;
  /** Undefined before hydration. */
  reminder: Reminder | null | undefined;
}) {
  const date = reminder?.dueDate ?? null;
  const eventDate = reminder?.eventDate ?? "";
  const [draftDate, setDraftDate] = useState(eventDate);
  const days = date ? daysUntil(date, todayIso()) : null;
  const inputId = `${kind}-${carId}`;

  const save = () => {
    saveReminder({
      car: carId,
      kind,
      title,
      dueDate: addYear(draftDate),
      eventDate: draftDate,
      dueKm: null,
      done: false,
    });
  };

  return (
    <div
      className={`deadline-card ${days != null && days <= 30 ? "deadline-card-due" : ""}`}
    >
      <p className="section-label mb-0">{title}</p>
      <p className="mt-2 flex min-h-9 items-center">
        {reminder === undefined ? (
          <Skeleton className="type-value w-56 max-w-full" />
        ) : date ? (
          <span className="type-value">{formatDate(date)}</span>
        ) : (
          <span className="type-value font-normal text-steel">
            Nie ustawiono
          </span>
        )}
      </p>
      <p className="mt-1 flex h-6 items-center">
        {days != null && <DueBadge days={days} />}
      </p>
      <p className="mt-2 text-sm text-graphite">{text}</p>
      <div className="mt-auto flex flex-wrap items-end gap-2 pt-4">
        <div className="min-w-44 flex-1">
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-semibold text-graphite"
          >
            {kind === "inspection"
              ? "Data ostatniego badania"
              : "Data rozpoczęcia polisy OC"}
          </label>
          <ReminderDatePicker
            id={inputId}
            value={draftDate}
            disabled={reminder === undefined}
            onChange={setDraftDate}
          />
        </div>
        {draftDate !== eventDate && (
          <button
            type="button"
            className="btn btn-primary h-11 shrink-0 justify-center px-4"
            disabled={!draftDate || reminder === undefined}
            onClick={save}
          >
            {date ? "Zapisz nową datę" : "Zatwierdź datę"}
          </button>
        )}
        {reminder && (
          <button
            type="button"
            className="btn btn-ghost h-11 shrink-0 justify-center"
            onClick={() => deleteReminder(reminder.id)}
          >
            Usuń termin
          </button>
        )}
      </div>
    </div>
  );
}
