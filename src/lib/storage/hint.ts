import { isValidId } from "@/lib/slug";
import { dueSoon, todayIso } from "@/lib/reminders";
import { FAVORITES_LIMIT, type AppData, type FontSize } from "./schema";

/**
 * Layout hint: a tiny summary of the browser data, mirrored to a cookie so the
 * server can render the first paint with the same layout as the hydrated page
 * (active car logo, the profile's cars, list lengths). It holds no notes or
 * highlights text and is never trusted for anything but layout; the real data
 * in localStorage replaces it right after hydration (docs/storage.md).
 */
export const HINT_COOKIE = "ocm-layout";

/** Recent list rows shown on the profile (history / highlights). */
export const PROFILE_LIST_LIMIT = 5;
/** Note cards shown on the profile. */
export const PROFILE_NOTES_LIMIT = 3;

const MAX_CARS = 24;
const MAX_COOKIE = 3600;

export interface LayoutHint {
  activeCar: string | null;
  ownedCars: string[];
  fontSize: FontSize;
  name: string;
  /** Profile counters: highlights, comments, bookmarks, notebook pages. */
  counts: [number, number, number, number];
  /** "Czytaj dalej" exactly as shown (`when` is preformatted). */
  lastRead: {
    car: string;
    title: string;
    href: string;
    when: string;
    thumb: string | null;
  } | null;
  /** Rows of "Ostatnio czytane". */
  read: number;
  /** Rows of "Ostatnie zaznaczenia": true = with a comment. */
  marks: boolean[];
  /** Cars with a saved offline copy. */
  offline: string[];
  /** Keys on the favourites bar (the car's bookmarks, at most six) per car. */
  bookmarks: Record<string, number>;
  /** Own ("custom") reminders per car. */
  reminders: Record<string, number>;
  /** Reminders due within 30 days or overdue (header badge). */
  due: number;
}

export const EMPTY_HINT: LayoutHint = {
  activeCar: null,
  ownedCars: [],
  fontSize: "normal",
  name: "",
  counts: [0, 0, 0, 0],
  lastRead: null,
  read: 0,
  marks: [],
  offline: [],
  bookmarks: {},
  reminders: {},
  due: 0,
};

const FONT_SIZES: FontSize[] = ["small", "normal", "large", "xlarge"];

/** Same format as "Czytaj dalej" uses for its date. */
export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL");

/** Builds the hint from the stored data (client only). */
export function buildHint(
  data: AppData,
  offlineCars: string[],
  today = todayIso(),
): LayoutHint {
  const { settings } = data;
  const highlights = Object.values(data.highlights);
  const lastRead = data.lastRead;
  const ownedCars = settings.ownedCars.slice(0, MAX_CARS);
  const bookmarks: Record<string, number> = {};
  for (const b of data.bookmarks)
    if (ownedCars.includes(b.car))
      bookmarks[b.car] = Math.min(FAVORITES_LIMIT, (bookmarks[b.car] ?? 0) + 1);
  const reminders: Record<string, number> = {};
  for (const r of data.reminders)
    if (r.kind === "custom" && ownedCars.includes(r.car))
      reminders[r.car] = (reminders[r.car] ?? 0) + 1;
  return {
    activeCar: settings.activeCar,
    ownedCars,
    fontSize: settings.fontSize,
    name: settings.profileName.trim(),
    counts: [
      highlights.length,
      highlights.filter((h) => h.comment.trim()).length,
      data.bookmarks.length,
      data.notebook.pages.length,
    ],
    lastRead: lastRead
      ? {
          car: lastRead.car,
          title: lastRead.title.slice(0, 160),
          href: lastRead.href,
          when: formatWhen(lastRead.at),
          thumb:
            data.history.find((h) => h.href === lastRead.href)?.thumb ?? null,
        }
      : null,
    read: Math.min(
      PROFILE_LIST_LIMIT,
      data.history.filter((h) => h.href !== lastRead?.href).length,
    ),
    marks: highlights
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, PROFILE_LIST_LIMIT)
      .map((h) => h.comment.trim() !== ""),
    offline: offlineCars.filter((id) => ownedCars.includes(id)),
    bookmarks,
    reminders,
    due: dueSoon(data.reminders, today, settings.ownedCars).length,
  };
}

/** Cookie value; drops the optional parts when it would grow too large. */
export function serializeHint(hint: LayoutHint): string {
  let value = encodeURIComponent(JSON.stringify(hint));
  if (value.length > MAX_COOKIE)
    value = encodeURIComponent(
      JSON.stringify({
        ...hint,
        lastRead: null,
        bookmarks: {},
        reminders: {},
        offline: [],
      }),
    );
  return value.length > MAX_COOKIE
    ? encodeURIComponent(JSON.stringify(EMPTY_HINT))
    : value;
}

const count = (v: unknown, max = 1_000_000) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(0, Math.round(v)))
    : 0;

const ids = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter(isValidId))].slice(0, MAX_CARS) : [];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : "";

/** Parses and validates a cookie value; anything unexpected is dropped. */
export function parseHint(value: string | undefined | null): LayoutHint {
  if (!value) return EMPTY_HINT;
  // Next.js may already have decoded the cookie value.
  let raw: unknown = null;
  for (const decode of [(v: string) => v, decodeURIComponent])
    try {
      raw = JSON.parse(decode(value));
      break;
    } catch {
      // try the next form
    }
  if (!isObject(raw)) return EMPTY_HINT;
  const ownedCars = ids(raw.ownedCars);
  const counts = Array.isArray(raw.counts) ? raw.counts : [];
  const lr = isObject(raw.lastRead) ? raw.lastRead : null;
  const href = lr ? text(lr.href, 400) : "";
  const thumb = lr ? text(lr.thumb, 400) : "";
  const perCar = (v: unknown, max: number) => {
    const out: Record<string, number> = {};
    if (isObject(v))
      for (const [car, n] of Object.entries(v).slice(0, MAX_CARS))
        if (isValidId(car) && count(n, max) > 0) out[car] = count(n, max);
    return out;
  };
  return {
    activeCar: isValidId(raw.activeCar) ? raw.activeCar : null,
    ownedCars,
    fontSize: FONT_SIZES.includes(raw.fontSize as FontSize)
      ? (raw.fontSize as FontSize)
      : "normal",
    name: text(raw.name, 80),
    counts: [
      count(counts[0]),
      count(counts[1]),
      count(counts[2]),
      count(counts[3]),
    ],
    lastRead:
      lr && isValidId(lr.car) && href.startsWith("/auto/")
        ? {
            car: lr.car,
            title: text(lr.title, 160),
            href,
            when: text(lr.when, 40),
            thumb: thumb.startsWith("/media/") ? thumb : null,
          }
        : null,
    read: count(raw.read, PROFILE_LIST_LIMIT),
    marks: Array.isArray(raw.marks)
      ? raw.marks.slice(0, PROFILE_LIST_LIMIT).map((m) => m === true)
      : [],
    offline: ids(raw.offline),
    bookmarks: perCar(raw.bookmarks, FAVORITES_LIMIT),
    reminders: perCar(raw.reminders, 50),
    due: count(raw.due, 999),
  };
}
