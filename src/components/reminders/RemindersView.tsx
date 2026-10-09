"use client";

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
        <p className="text-lg">
          Przypomnienia ustawisz dla aut ze swojego profilu.
        </p>
        <Link href="/#auta" className="btn btn-primary mt-4">
          Wybierz auto
        </Link>
      </div>
    );

  return (
    <div className="space-y-8">
      {myCars.length > 1 && (
        <nav aria-label="Auta" className="flex flex-wrap gap-2">
          {myCars.map((car) => (
            <a key={car.id} href={`#${car.id}`} className="btn">
              {car.label}
            </a>
          ))}
        </nav>
      )}
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
        <CarLogo carId={car.id} brand={car.brand} size={40} />
        <div className="min-w-0 flex-1">
          <h2 id={`${car.id}-title`} className="text-xl font-semibold">
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
        {FIXED_REMINDERS.map((f) => (
          <DeadlineCard
            key={f.kind}
            carId={car.id}
            kind={f.kind}
            title={f.title}
            text={f.text}
            reminder={
              reminders
                ? (reminders.find(
                    (r) => r.id === fixedReminderId(f.kind, car.id),
                  ) ?? null)
                : undefined
            }
          />
        ))}
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
  const days = date ? daysUntil(date, todayIso()) : null;
  const inputId = `${kind}-${carId}`;

  const save = (dueDate: string | null) => {
    if (!dueDate) {
      deleteReminder(fixedReminderId(kind, carId));
      return;
    }
    saveReminder({
      car: carId,
      kind,
      title,
      dueDate,
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
          <Skeleton className="h-8 w-56 max-w-full" />
        ) : date ? (
          <span className="text-2xl font-semibold tabular-nums">
            {formatDate(date)}
          </span>
        ) : (
          <span className="text-2xl text-steel">Nie ustawiono</span>
        )}
      </p>
      <p className="mt-1 flex h-6 items-center">
        {days != null && <DueBadge days={days} />}
      </p>
      <p className="mt-2 text-sm text-graphite">{text}</p>
      <div className="mt-auto flex flex-wrap items-end gap-2 pt-4">
        <label htmlFor={inputId} className="min-w-44 flex-1">
          <span className="mb-1 block text-sm font-semibold text-graphite">
            Data terminu
          </span>
          <input
            id={inputId}
            type="date"
            className="field"
            value={date ?? ""}
            disabled={reminder === undefined}
            onChange={(e) => save(e.target.value || null)}
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={!date}
          title="Przesuwa termin o rok"
          onClick={() => date && save(addYear(date))}
        >
          Załatwione – za rok
        </button>
      </div>
    </div>
  );
}
