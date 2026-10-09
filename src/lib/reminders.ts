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

/** Whether a calendar date is later than today. */
export function isFutureDate(date: string, today: string): boolean {
  return daysUntil(date, today) > 0;
}

/**
 * Cleans a typed date: keeps digits and `.`/`,`/`/` (separators become dots);
 * digit-only input gets dots inserted as `DD.MM.YYYY`.
 */
export function formatManualDateInput(value: string): string {
  const cleaned = value.replace(/[^\d.,/]/g, "").replace(/[,/]/g, ".");
  if (cleaned.includes(".")) return cleaned.slice(0, 10);
  const digits = cleaned.slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/** `YYYY-MM-DD` → `DD.MM.YYYY`. */
export function toManualDate(date: string): string {
  return date.split("-").reverse().join(".");
}

/** Parses `DDMMYYYY` or `D.M.YYYY` (`.`, `,` or `/`) into `YYYY-MM-DD`. */
export function parseManualDate(value: string): string | null {
  const match =
    /^(\d{2})(\d{2})(\d{4})$/.exec(value) ??
    /^(\d{1,2})[.,/](\d{1,2})[.,/](\d{4})$/.exec(value);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    year < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Same day one year later (29 February → 28 February). */
export function addYear(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Six Monday-first calendar weeks for a month numbered 1–12. */
export function getMonthGridDays(
  year: number,
  month: number,
): (number | null)[] {
  const leadingDays = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
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
