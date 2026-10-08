import {
  DEFAULT_SETTINGS,
  EXPORT_APP_ID,
  SCHEMA_VERSION,
  createEmptyData,
  type AppData,
  type Bookmark,
  type FontSize,
  type Highlight,
  type HighlightColor,
  type LastRead,
  type NotePage,
  type Settings,
} from "./schema";

/**
 * Migrations upgrade stored data one version at a time:
 * `MIGRATIONS[n]` converts data of version `n` into version `n + 1`.
 * Add an entry whenever `SCHEMA_VERSION` is bumped.
 */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Record<number, Migration> = {
  // Data written before versioning existed (no `version` field) is treated
  // as version 0 and has the same shape as version 1.
  0: (data) => ({ ...data, version: 1 }),
};

export class UnsupportedVersionError extends Error {
  constructor(public readonly found: number) {
    super(`Dane zapisane w nowszej wersji aplikacji (wersja ${found}).`);
    this.name = "UnsupportedVersionError";
  }
}

export class InvalidDataError extends Error {
  constructor(message = "Nieprawidłowy format danych.") {
    super(message);
    this.name = "InvalidDataError";
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const COLORS: HighlightColor[] = ["light", "silver", "graphite", "red"];
const FONT_SIZES: FontSize[] = ["small", "normal", "large", "xlarge"];
const BOOKS = ["manual", "infotainment"] as const;

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
    if (!step) throw new InvalidDataError(`Brak migracji z wersji ${version}.`);
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
      .map(
        (p): NotePage => ({
          id: str(p.id),
          title: str(p.title, "Bez tytułu"),
          body: str(p.body),
          createdAt: str(p.createdAt, new Date(0).toISOString()),
          updatedAt: str(p.updatedAt, str(p.createdAt, new Date(0).toISOString())),
        }),
      );
  }

  if (Array.isArray(data.bookmarks)) {
    out.bookmarks = data.bookmarks
      .filter(isObject)
      .filter((b) => typeof b.sectionId === "string" && BOOKS.includes(b.book as never))
      .map(
        (b): Bookmark => ({
          id: str(b.id, `${str(b.book)}:${str(b.sectionId)}`),
          book: b.book as Bookmark["book"],
          sectionId: str(b.sectionId),
          title: str(b.title),
          href: str(b.href),
          createdAt: str(b.createdAt, new Date(0).toISOString()),
        }),
      );
  }

  const lr = data.lastRead;
  if (isObject(lr) && typeof lr.href === "string" && BOOKS.includes(lr.book as never)) {
    out.lastRead = {
      book: lr.book as LastRead["book"],
      sectionId: str(lr.sectionId),
      title: str(lr.title),
      href: str(lr.href),
      scrollY: num(lr.scrollY),
      at: str(lr.at, new Date(0).toISOString()),
    };
  }

  const s = isObject(data.settings) ? data.settings : {};
  const settings: Settings = { ...DEFAULT_SETTINGS, vehicle: {} };
  if (FONT_SIZES.includes(s.fontSize as FontSize)) settings.fontSize = s.fontSize as FontSize;
  if (typeof s.showUnavailable === "boolean") settings.showUnavailable = s.showUnavailable;
  if (isObject(s.vehicle)) {
    for (const [id, state] of Object.entries(s.vehicle)) {
      if (
        isObject(state) &&
        (state.status === "has" || state.status === "no") &&
        (state.certainty === "confirmed" || state.certainty === "verify" || state.certainty === "probable")
      ) {
        settings.vehicle[id] = { status: state.status, certainty: state.certainty };
      }
    }
  }
  out.settings = settings;
  return out;
}

function sanitizeHighlight(id: string, h: unknown): Highlight | null {
  if (!isObject(h) || !isObject(h.anchor)) return null;
  if (!BOOKS.includes(h.book as never) || typeof h.sectionId !== "string") return null;
  const a = h.anchor;
  if (typeof a.exact !== "string" || !a.exact) return null;
  return {
    id: str(h.id, id),
    book: h.book as Highlight["book"],
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
    color: COLORS.includes(h.color as HighlightColor) ? (h.color as HighlightColor) : "silver",
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
    throw new InvalidDataError("Plik nie jest prawidłowym plikiem JSON.");
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
 * recently updated version wins. Settings are kept from `current`.
 */
export function mergeData(current: AppData, incoming: AppData): AppData {
  const highlights = { ...current.highlights };
  for (const h of Object.values(incoming.highlights)) {
    const existing = highlights[h.id];
    if (!existing || existing.updatedAt < h.updatedAt) highlights[h.id] = h;
  }
  const pages = [...current.notebook.pages];
  for (const p of incoming.notebook.pages) {
    const i = pages.findIndex((x) => x.id === p.id);
    if (i === -1) pages.push(p);
    else if (pages[i].updatedAt < p.updatedAt) pages[i] = p;
  }
  const bookmarks = [...current.bookmarks];
  for (const b of incoming.bookmarks) {
    if (!bookmarks.some((x) => x.id === b.id)) bookmarks.push(b);
  }
  const lastRead =
    !current.lastRead || (incoming.lastRead && incoming.lastRead.at > current.lastRead.at)
      ? incoming.lastRead
      : current.lastRead;
  return {
    ...current,
    highlights,
    notebook: { pages },
    bookmarks,
    lastRead,
  };
}
