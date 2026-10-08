import type { FeatureState } from "@/config/vehicle";
import type { BookId } from "@/content/types";

/**
 * Persisted application data (localStorage, single key).
 * Bump `SCHEMA_VERSION` and add a migration in `migrations.ts` whenever the
 * shape changes. See docs/storage.md.
 */

export const STORAGE_KEY = "opel-cascada-manual";
export const SCHEMA_VERSION = 1;
export const EXPORT_APP_ID = "opel-cascada-manual";

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
  book: BookId;
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
  /** `${book}:${sectionId}` */
  id: string;
  book: BookId;
  sectionId: string;
  title: string;
  href: string;
  createdAt: string;
}

export interface LastRead {
  book: BookId;
  sectionId: string;
  title: string;
  href: string;
  scrollY: number;
  at: string;
}

export type FontSize = "small" | "normal" | "large" | "xlarge";

export interface Settings {
  fontSize: FontSize;
  /** Expand sections describing equipment the car does not have. */
  showUnavailable: boolean;
  /** Overrides of `DEFAULT_PROFILE` keyed by feature id. */
  vehicle: Record<string, FeatureState>;
}

export interface AppData {
  version: typeof SCHEMA_VERSION;
  highlights: Record<string, Highlight>;
  notebook: { pages: NotePage[] };
  bookmarks: Bookmark[];
  lastRead: LastRead | null;
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
  vehicle: {},
};

export function createEmptyData(): AppData {
  return {
    version: SCHEMA_VERSION,
    highlights: {},
    notebook: { pages: [] },
    bookmarks: [],
    lastRead: null,
    settings: { ...DEFAULT_SETTINGS, vehicle: {} },
  };
}

/** Frozen empty snapshot used for server rendering / hydration. */
export const EMPTY_DATA: AppData = Object.freeze(createEmptyData()) as AppData;
