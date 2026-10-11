import {
  DEFAULT_SETTINGS,
  EXPORT_APP_ID,
  SCHEMA_VERSION,
  createEmptyData,
  type AppData,
  HISTORY_LIMIT,
  REMINDER_KINDS,
  fixedReminderId,
  type Bookmark,
  type FontSize,
  type HistoryEntry,
  type Reminder,
  type ReminderKind,
  type Highlight,
  type HighlightColor,
  type NotePage,
  type Settings,
} from "./schema";
import { FEATURE_BY_ID, type FeatureState } from "@/config/vehicle";
import { isValidId } from "@/lib/slug";
import { sanitizeEngine } from "@/lib/engines";

export class UnsupportedVersionError extends Error {
  constructor(public readonly found: number) {
    super("Kopia pochodzi z nieobsługiwanej wersji Glovebox.");
    this.name = "UnsupportedVersionError";
  }
}

export class InvalidDataError extends Error {
  constructor(message = "Nie udało się odczytać danych.") {
    super(message);
    this.name = "InvalidDataError";
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const COLORS: HighlightColor[] = ["light", "silver", "graphite", "red"];
const FONT_SIZES: FontSize[] = ["small", "normal", "large", "xlarge"];

/** Validates the current Glovebox schema; no historical data is upgraded. */
export function parseData(raw: unknown): AppData {
  if (!isObject(raw)) throw new InvalidDataError();
  if (typeof raw.version !== "number" || !Number.isInteger(raw.version))
    throw new InvalidDataError("Kopia nie zawiera prawidłowej wersji danych.");
  if (raw.version !== SCHEMA_VERSION)
    throw new UnsupportedVersionError(raw.version);
  return sanitize(raw);
}

/** Drops malformed entries instead of failing the whole document. */
export function sanitize(data: Record<string, unknown>): AppData {
  const out = createEmptyData();

  if (isObject(data.highlights)) {
    for (const [id, h] of Object.entries(data.highlights)) {
      const hl = sanitizeHighlight(id, h);
      if (hl) out.highlights[hl.id] = hl;
    }
  }

  const notebook = isObject(data.notebook) ? data.notebook : {};
  if (Array.isArray(notebook.pages)) {
    out.notebook.pages = notebook.pages
      .filter(isObject)
      .filter((p) => typeof p.id === "string")
      .map((p): NotePage => ({
        id: str(p.id),
        title: str(p.title, "Bez tytułu"),
        body: str(p.body),
        createdAt: str(p.createdAt, new Date(0).toISOString()),
        updatedAt: str(
          p.updatedAt,
          str(p.createdAt, new Date(0).toISOString()),
        ),
      }));
  }

  if (Array.isArray(data.bookmarks)) {
    out.bookmarks = data.bookmarks
      .filter(isObject)
      .filter(
        (b) =>
          typeof b.sectionId === "string" &&
          isValidId(b.car) &&
          isValidId(b.book),
      )
      .map((b): Bookmark => ({
        id: `${str(b.car)}:${str(b.book)}:${str(b.sectionId)}`,
        car: str(b.car),
        book: str(b.book),
        sectionId: str(b.sectionId),
        title: str(b.title),
        href: str(b.href),
        createdAt: str(b.createdAt, new Date(0).toISOString()),
      }));
  }

  const lr = data.lastRead;
  if (
    isObject(lr) &&
    typeof lr.href === "string" &&
    isValidId(lr.car) &&
    isValidId(lr.book)
  ) {
    out.lastRead = {
      car: lr.car,
      book: lr.book,
      sectionId: str(lr.sectionId),
      title: str(lr.title),
      href: str(lr.href),
      scrollY: num(lr.scrollY),
      at: str(lr.at, new Date(0).toISOString()),
    };
  }

  if (Array.isArray(data.history)) {
    const seen = new Set<string>();
    out.history = data.history
      .map(sanitizeHistory)
      .filter((h): h is HistoryEntry => h !== null)
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter((h) => {
        const key = historyKey(h);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, HISTORY_LIMIT);
  }

  if (Array.isArray(data.reminders)) {
    const ids = new Set<string>();
    out.reminders = data.reminders
      .map(sanitizeReminder)
      .filter((r): r is Reminder => {
        if (!r || ids.has(r.id)) return false;
        ids.add(r.id);
        return true;
      });
  }

  const s = isObject(data.settings) ? data.settings : {};
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    vehicles: {},
    engines: {},
  };
  if (FONT_SIZES.includes(s.fontSize as FontSize))
    settings.fontSize = s.fontSize as FontSize;
  if (typeof s.showUnavailable === "boolean")
    settings.showUnavailable = s.showUnavailable;
  if (isValidId(s.activeCar)) settings.activeCar = s.activeCar;
  if (Array.isArray(s.ownedCars))
    settings.ownedCars = [...new Set(s.ownedCars.filter(isValidId))];
  if (typeof s.profileName === "string")
    settings.profileName = s.profileName.slice(0, 80);
  if (isObject(s.vehicles)) {
    for (const [car, profile] of Object.entries(s.vehicles)) {
      if (!isValidId(car) || !isObject(profile)) continue;
      const clean = sanitizeProfile(profile);
      if (Object.keys(clean).length > 0) settings.vehicles[car] = clean;
    }
  }
  if (isObject(s.engines)) {
    for (const [car, engine] of Object.entries(s.engines)) {
      if (!isValidId(car)) continue;
      const clean = sanitizeEngine(engine);
      if (engine === null || clean) settings.engines[car] = clean;
    }
  }
  out.settings = settings;
  return out;
}

/** Key of a history entry: one entry per section. */
export const historyKey = (
  h: Pick<HistoryEntry, "car" | "book" | "sectionId">,
) => `${h.car}:${h.book}:${h.sectionId}`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

function sanitizeHistory(h: unknown): HistoryEntry | null {
  if (
    !isObject(h) ||
    !isValidId(h.car) ||
    !isValidId(h.book) ||
    typeof h.sectionId !== "string" ||
    typeof h.href !== "string" ||
    !h.href.startsWith("/auto/")
  )
    return null;
  return {
    car: h.car,
    book: h.book,
    sectionId: h.sectionId,
    title: str(h.title),
    href: h.href,
    // Only local illustrations: the app makes no third-party requests.
    thumb:
      typeof h.thumb === "string" && h.thumb.startsWith("/media/")
        ? h.thumb
        : null,
    at: str(h.at, new Date(0).toISOString()),
  };
}

function sanitizeReminder(r: unknown): Reminder | null {
  if (!isObject(r) || typeof r.id !== "string" || !r.id || !isValidId(r.car))
    return null;
  const kind: ReminderKind = REMINDER_KINDS.includes(r.kind as ReminderKind)
    ? (r.kind as ReminderKind)
    : "custom";
  const title = str(r.title).trim().slice(0, 120);
  if (!title) return null;
  const km =
    typeof r.dueKm === "number" && Number.isFinite(r.dueKm)
      ? Math.round(r.dueKm)
      : null;
  return {
    id: kind === "custom" ? r.id : fixedReminderId(kind, r.car),
    car: r.car,
    kind,
    title,
    dueDate: isValidDate(r.dueDate) ? r.dueDate : null,
    eventDate: isValidDate(r.eventDate) ? r.eventDate : null,
    dueKm: km != null && km >= 0 && km <= 5_000_000 ? km : null,
    done: r.done === true,
    createdAt: str(r.createdAt, new Date(0).toISOString()),
    updatedAt: str(r.updatedAt, str(r.createdAt, new Date(0).toISOString())),
  };
}

/** Keeps valid states of known features only. */
function sanitizeProfile(
  profile: Record<string, unknown>,
): Record<string, FeatureState> {
  const out: Record<string, FeatureState> = {};
  for (const [id, state] of Object.entries(profile)) {
    if (
      FEATURE_BY_ID[id] &&
      isObject(state) &&
      (state.status === "has" || state.status === "no") &&
      (state.certainty === "confirmed" || state.certainty === "probable")
    )
      out[id] = { status: state.status, certainty: state.certainty };
  }
  return out;
}

function sanitizeHighlight(id: string, h: unknown): Highlight | null {
  if (!isObject(h) || !isObject(h.anchor)) return null;
  if (
    !isValidId(h.car) ||
    !isValidId(h.book) ||
    typeof h.sectionId !== "string"
  )
    return null;
  const a = h.anchor;
  if (typeof a.exact !== "string" || !a.exact) return null;
  return {
    id: str(h.id, id),
    car: h.car,
    book: h.book,
    sectionId: h.sectionId,
    sectionTitle: str(h.sectionTitle),
    href: str(h.href),
    anchor: {
      exact: a.exact,
      prefix: str(a.prefix),
      suffix: str(a.suffix),
      start: num(a.start),
      end: num(a.end, num(a.start) + a.exact.length),
    },
    color: COLORS.includes(h.color as HighlightColor)
      ? (h.color as HighlightColor)
      : "silver",
    comment: str(h.comment),
    createdAt: str(h.createdAt, new Date(0).toISOString()),
    updatedAt: str(h.updatedAt, str(h.createdAt, new Date(0).toISOString())),
  };
}

/** Accepts only a versioned Glovebox export file. */
export function parseImport(json: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidDataError("Nie udało się odczytać pliku kopii.");
  }
  if (!isObject(parsed) || parsed.app !== EXPORT_APP_ID)
    throw new InvalidDataError("Plik nie jest kopią danych Glovebox.");
  return parseData(parsed.data);
}

/**
 * Merges imported data into current data. Items are matched by id, the more
 * recently updated version wins. Settings are kept from `current`, except
 * equipment of cars that `current` knows nothing about.
 */
export function mergeData(current: AppData, incoming: AppData): AppData {
  const highlights = { ...current.highlights };
  for (const h of Object.values(incoming.highlights)) {
    const existing = highlights[h.id];
    if (!existing || existing.updatedAt < h.updatedAt) highlights[h.id] = h;
  }
  const pages = [...current.notebook.pages];
  const pageIndex = new Map(pages.map((p, i) => [p.id, i]));
  for (const p of incoming.notebook.pages) {
    const i = pageIndex.get(p.id);
    if (i === undefined) {
      pageIndex.set(p.id, pages.length);
      pages.push(p);
    } else if (pages[i].updatedAt < p.updatedAt) pages[i] = p;
  }
  const bookmarks = [...current.bookmarks];
  const bookmarkIds = new Set(bookmarks.map((b) => b.id));
  for (const b of incoming.bookmarks) {
    if (!bookmarkIds.has(b.id)) {
      bookmarkIds.add(b.id);
      bookmarks.push(b);
    }
  }
  const lastRead =
    !current.lastRead ||
    (incoming.lastRead && incoming.lastRead.at > current.lastRead.at)
      ? incoming.lastRead
      : current.lastRead;
  const vehicles = { ...current.settings.vehicles };
  for (const [car, profile] of Object.entries(incoming.settings.vehicles))
    vehicles[car] = { ...profile, ...vehicles[car] };
  const ownedCars = [
    ...new Set([...current.settings.ownedCars, ...incoming.settings.ownedCars]),
  ];
  const history = new Map<string, HistoryEntry>();
  for (const h of [...current.history, ...incoming.history]) {
    const existing = history.get(historyKey(h));
    if (!existing || existing.at < h.at) history.set(historyKey(h), h);
  }
  const reminders = [...current.reminders];
  const reminderIndex = new Map(reminders.map((r, i) => [r.id, i]));
  for (const r of incoming.reminders) {
    const i = reminderIndex.get(r.id);
    if (i === undefined) {
      reminderIndex.set(r.id, reminders.length);
      reminders.push(r);
    } else if (reminders[i].updatedAt < r.updatedAt) reminders[i] = r;
  }
  return {
    ...current,
    highlights,
    notebook: { pages },
    bookmarks,
    lastRead,
    history: [...history.values()]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, HISTORY_LIMIT),
    reminders,
    settings: {
      ...current.settings,
      vehicles,
      ownedCars,
      engines: { ...incoming.settings.engines, ...current.settings.engines },
    },
  };
}
