import type { FeatureState } from "@/config/vehicle";
import type { CarSpec } from "@/lib/catalog";

/**
 * Persisted application data (localStorage, single key).
 * Bump `SCHEMA_VERSION` and update validation in `data.ts` whenever the
 * shape changes. See docs/storage.md.
 */

export const STORAGE_KEY = "glovebox";
export const SCHEMA_VERSION = 1;
export const EXPORT_APP_ID = "glovebox";
export const CACHE_PREFIX = "glovebox-";

export type HighlightColor = "light" | "silver" | "graphite" | "red";

/** W3C TextQuoteSelector + TextPositionSelector, relative to the section text. */
export interface TextAnchor {
  exact: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
}

export interface Highlight {
  id: string;
  /** Car id (`database/<car>`). */
  car: string;
  /** Book id inside the car. */
  book: string;
  sectionId: string;
  sectionTitle: string;
  href: string;
  anchor: TextAnchor;
  color: HighlightColor;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotePage {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  /** `${car}:${book}:${sectionId}` */
  id: string;
  car: string;
  book: string;
  sectionId: string;
  title: string;
  href: string;
  createdAt: string;
}

export interface LastRead {
  car: string;
  book: string;
  sectionId: string;
  title: string;
  href: string;
  scrollY: number;
  at: string;
}

/** One recently read section (newest first, see `HISTORY_LIMIT`). */
export interface HistoryEntry {
  car: string;
  book: string;
  sectionId: string;
  title: string;
  href: string;
  /** First illustration of the section (`/media/…`), if it has one. */
  thumb: string | null;
  at: string;
}

/**
 * Kind of a reminder: the yearly technical inspection and the OC insurance
 * have one fixed entry per car (id `${kind}:${car}`); `custom` entries are
 * the owner's own (service, oil change, tyres …).
 */
export type ReminderKind = "inspection" | "insurance" | "custom";

export const REMINDER_KINDS: ReminderKind[] = [
  "inspection",
  "insurance",
  "custom",
];

/** Owner's reminder for one car (date and/or mileage). */
export interface Reminder {
  id: string;
  car: string;
  kind: ReminderKind;
  title: string;
  /** `YYYY-MM-DD` or null. */
  dueDate: string | null;
  /** Date of the last inspection or OC policy start, when applicable. */
  eventDate: string | null;
  /** Mileage in km or null. */
  dueKm: number | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Id of the fixed reminder of a kind for one car. */
export const fixedReminderId = (
  kind: Exclude<ReminderKind, "custom">,
  car: string,
) => `${kind}:${car}`;

export const HISTORY_LIMIT = 12;
export const FAVORITES_LIMIT = 6;

export type FontSize = "small" | "normal" | "large" | "xlarge";

export interface Settings {
  fontSize: FontSize;
  /** Expand sections describing equipment the car does not have. */
  showUnavailable: boolean;
  /**
   * Equipment of each car: car id → feature id → state. Features without a
   * state are unknown ("Nie wiem").
   */
  vehicles: Record<string, Record<string, FeatureState>>;
  /** Engine of the owner's car, not of the shared manual library. Null means explicitly unknown. */
  engines: Record<string, CarSpec | null>;
  /** Car chosen on the profile page (`database/<car>`), if any. */
  activeCar: string | null;
  /** Cars added to this browser profile from the shared manuals library. */
  ownedCars: string[];
  /** Optional display name of the local profile. */
  profileName: string;
}

export interface AppData {
  version: typeof SCHEMA_VERSION;
  highlights: Record<string, Highlight>;
  notebook: { pages: NotePage[] };
  bookmarks: Bookmark[];
  lastRead: LastRead | null;
  history: HistoryEntry[];
  reminders: Reminder[];
  settings: Settings;
}

export interface ExportFile {
  app: typeof EXPORT_APP_ID;
  exportedAt: string;
  data: AppData;
}

export const DEFAULT_SETTINGS: Settings = {
  fontSize: "normal",
  showUnavailable: false,
  vehicles: {},
  engines: {},
  activeCar: null,
  ownedCars: [],
  profileName: "",
};

export function createEmptyData(): AppData {
  return {
    version: SCHEMA_VERSION,
    highlights: {},
    notebook: { pages: [] },
    bookmarks: [],
    lastRead: null,
    history: [],
    reminders: [],
    settings: { ...DEFAULT_SETTINGS, vehicles: {}, engines: {} },
  };
}

/** Frozen empty snapshot used for server rendering / hydration. */
export const EMPTY_DATA: AppData = Object.freeze(createEmptyData()) as AppData;
