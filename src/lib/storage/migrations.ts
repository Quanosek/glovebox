import {
  DEFAULT_SETTINGS,
  EXPORT_APP_ID,
  SCHEMA_VERSION,
  createEmptyData,
  type AppData,
  FAVORITES_LIMIT,
  HISTORY_LIMIT,
  type Bookmark,
  type FontSize,
  type HistoryEntry,
  type Reminder,
  type Highlight,
  type HighlightColor,
  type NotePage,
  type Settings,
} from "./schema";
import {
  FEATURE_BY_ID,
  RENAMED_FEATURES,
  type FeatureState,
} from "@/config/vehicle";
import { isValidId } from "@/lib/slug";

const LEGACY_CAR_ID = "opel-cascada-2016";

/**
 * Migrations upgrade stored data one version at a time:
 * `MIGRATIONS[n]` converts data of version `n` into version `n + 1`.
 * Add an entry whenever `SCHEMA_VERSION` is bumped.
 */
export type Migration = (
  data: Record<string, unknown>,
) => Record<string, unknown>;

export const MIGRATIONS: Record<number, Migration> = {
  // Data written before versioning existed (no `version` field) is treated
  // as version 0 and has the same shape as version 1.
  0: (data) => ({ ...data, version: 1 }),
  // v2: multiple cars. Older single-car data keeps its original car association.
  1: migrateV1toV2,
  // v3: equipment profiles are stored separately for each car.
  2: migrateV2toV3,
  // v4: cars are assigned to a local profile instead of all being shown by default.
  3: migrateV3toV4,
  // v5: reading history, service reminders and per-car favourites.
  4: migrateV4toV5,
};

const V1_ROUTES = ["/instrukcja", "/navi-950"];

/** Rewrites historic single-car URLs to their original car URL. */
export function upgradeV1Href(href: string): string {
  for (const route of V1_ROUTES) {
    if (
      href === route ||
      href.startsWith(`${route}/`) ||
      href.startsWith(`${route}#`)
    )
      return `/auto/${LEGACY_CAR_ID}${href}`;
  }
  return href;
}

function migrateV1toV2(data: Record<string, unknown>) {
  const withCar = (item: unknown) =>
    isObject(item)
      ? {
          ...item,
          car: LEGACY_CAR_ID,
          href: typeof item.href === "string" ? upgradeV1Href(item.href) : "",
        }
      : item;
  const highlights: Record<string, unknown> = {};
  if (isObject(data.highlights)) {
    for (const [id, h] of Object.entries(data.highlights))
      highlights[id] = withCar(h);
  }
  const bookmarks = Array.isArray(data.bookmarks)
    ? data.bookmarks.map((b) =>
        isObject(b)
          ? {
              ...(withCar(b) as Record<string, unknown>),
              id: `${LEGACY_CAR_ID}:${str(b.book)}:${str(b.sectionId)}`,
            }
          : b,
      )
    : [];
  const hasData =
    Object.keys(highlights).length > 0 ||
    bookmarks.length > 0 ||
    isObject(data.lastRead);
  const settings = isObject(data.settings) ? data.settings : {};
  return {
    ...data,
    highlights,
    bookmarks,
    lastRead: isObject(data.lastRead) ? withCar(data.lastRead) : null,
    settings: {
      ...settings,
      activeCar: hasData ? LEGACY_CAR_ID : null,
    },
  };
}

function migrateV2toV3(data: Record<string, unknown>) {
  const settings = isObject(data.settings) ? { ...data.settings } : {};
  const vehicles: Record<string, unknown> = {};
  if (isObject(settings.vehicle)) {
    const legacyProfile: Record<string, unknown> = {};
    for (const [id, state] of Object.entries(settings.vehicle))
      legacyProfile[RENAMED_FEATURES[id] ?? id] ??= state;
    if (Object.keys(legacyProfile).length > 0)
      vehicles[LEGACY_CAR_ID] = legacyProfile;
  }
  delete settings.vehicle;
  return { ...data, settings: { ...settings, vehicles } };
}

function migrateV3toV4(data: Record<string, unknown>) {
  const settings = isObject(data.settings) ? { ...data.settings } : {};
  const ownedCars = new Set<string>();
  const addCar = (value: unknown) => {
    if (isValidId(value)) ownedCars.add(value);
  };
  addCar(settings.activeCar);
  if (isObject(settings.vehicles))
    for (const car of Object.keys(settings.vehicles)) addCar(car);
  if (isObject(data.highlights))
    for (const highlight of Object.values(data.highlights))
      if (isObject(highlight)) addCar(highlight.car);
  if (Array.isArray(data.bookmarks))
    for (const bookmark of data.bookmarks)
      if (isObject(bookmark)) addCar(bookmark.car);
  if (isObject(data.lastRead)) addCar(data.lastRead.car);
  return {
    ...data,
    settings: { ...settings, ownedCars: [...ownedCars] },
  };
}

function migrateV4toV5(data: Record<string, unknown>) {
  const settings = isObject(data.settings) ? { ...data.settings } : {};
  const lr = data.lastRead;
  const history = isObject(lr)
    ? [
        {
          car: lr.car,
          book: lr.book,
          sectionId: lr.sectionId,
          title: lr.title,
          href: lr.href,
          thumb: null,
          at: lr.at,
        },
      ]
    : [];
  return {
    ...data,
    history,
    reminders: [],
    settings: { ...settings, favorites: {} },
  };
}

export class UnsupportedVersionError extends Error {
  constructor(public readonly found: number) {
    super(`Kopia pochodzi z nowszej wersji aplikacji (wersja ${found}).`);
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

/** Upgrades raw stored data to the current schema and validates it. */
export function migrate(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): AppData {
  if (raw == null) return createEmptyData();
  if (!isObject(raw)) throw new InvalidDataError();
  let data: Record<string, unknown> = raw;
  let version = typeof data.version === "number" ? data.version : 0;
  if (version > target) throw new UnsupportedVersionError(version);
  while (version < target) {
    const step = migrations[version];
    if (!step)
      throw new InvalidDataError(
        `Kopia pochodzi ze zbyt starej wersji aplikacji (wersja ${version}).`,
      );
    data = step(data);
    version += 1;
    data.version = version;
  }
  return sanitize(data);
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
    favorites: {},
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
  if (isObject(s.favorites)) {
    const bookmarkIds = new Set(out.bookmarks.map((b) => b.id));
    for (const [car, ids] of Object.entries(s.favorites)) {
      if (!isValidId(car) || !Array.isArray(ids)) continue;
      const clean = [
        ...new Set(
          ids.filter(
            (id): id is string =>
              typeof id === "string" &&
              id.startsWith(`${car}:`) &&
              bookmarkIds.has(id),
          ),
        ),
      ].slice(0, FAVORITES_LIMIT);
      if (clean.length > 0) settings.favorites[car] = clean;
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
  const title = str(r.title).trim().slice(0, 120);
  if (!title) return null;
  const km =
    typeof r.dueKm === "number" && Number.isFinite(r.dueKm)
      ? Math.round(r.dueKm)
      : null;
  return {
    id: r.id,
    car: r.car,
    title,
    dueDate:
      typeof r.dueDate === "string" && DATE.test(r.dueDate) ? r.dueDate : null,
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
      (state.certainty === "confirmed" ||
        state.certainty === "verify" ||
        state.certainty === "probable")
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

/** Accepts an export file (`{ app, data }`) or a bare data object. */
export function parseImport(json: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidDataError("Nie udało się odczytać pliku kopii.");
  }
  if (isObject(parsed) && "data" in parsed) {
    if (parsed.app !== EXPORT_APP_ID) {
      throw new InvalidDataError("Plik nie pochodzi z tej aplikacji.");
    }
    return migrate(parsed.data);
  }
  return migrate(parsed);
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
  const favorites = { ...current.settings.favorites };
  for (const [car, ids] of Object.entries(incoming.settings.favorites))
    favorites[car] = [...new Set([...(favorites[car] ?? []), ...ids])].slice(
      0,
      FAVORITES_LIMIT,
    );
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
    settings: { ...current.settings, vehicles, ownedCars, favorites },
  };
}
