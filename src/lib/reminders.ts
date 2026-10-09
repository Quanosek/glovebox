import type { Reminder, ReminderKind } from "@/lib/storage/schema";

/**
 * Pure helpers for owner reminders (`/przypomnienia`, car page tile, header
 * badge). Dates are local calendar days in `YYYY-MM-DD`.
 */

export const FIXED_REMINDERS: {
  kind: Exclude<ReminderKind, "custom">;
  title: string;
  text: string;
}[] = [
  {
    kind: "inspection",
    title: "Badanie techniczne",
    text: "Obowiązkowe okresowe badanie techniczne w stacji kontroli pojazdów.",
  },
  {
    kind: "insurance",
    title: "Ubezpieczenie OC",
    text: "Koniec obecnej polisy OC – nowa musi zacząć się najpóźniej następnego dnia.",
  },
];

export const REMINDER_SUGGESTIONS = [
  "Przegląd okresowy",
  "Wymiana oleju",
  "Wymiana opon",
  "Ubezpieczenie AC",
  "Płyn hamulcowy",
  "Filtr kabinowy",
];

/** Days shown as "soon" (header badge, emphasised badge). */
export const SOON_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const utc = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from `today` to `date` (negative when it has passed). */
export function daysUntil(date: string, today: string): number {
  return Math.round((utc(date) - utc(today)) / DAY);
}

/** Same day one year later (29 February → 28 February). */
export function addYear(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Open reminders of a car, nearest date first; undated ones at the end. */
export function sortReminders(list: Reminder[]): Reminder[] {
  const key = (r: Reminder) =>
    `${r.done ? 1 : 0}${r.dueDate ?? "9999-99-99"}${String(r.dueKm ?? 9e9).padStart(12, "0")}`;
  return [...list].sort((a, b) => key(a).localeCompare(key(b)));
}

/** Open dated reminders that passed or are due within `SOON_DAYS`. */
export function dueSoon(
  list: Reminder[],
  today: string,
  cars?: string[],
): Reminder[] {
  return list.filter(
    (r) =>
      !r.done &&
      r.dueDate !== null &&
      (!cars || cars.includes(r.car)) &&
      daysUntil(r.dueDate, today) <= SOON_DAYS,
  );
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
