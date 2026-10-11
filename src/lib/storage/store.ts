import {
  STORAGE_KEY,
  EXPORT_APP_ID,
  createEmptyData,
  type AppData,
  type ExportFile,
} from "./schema";
import { mergeData, parseData, parseImport } from "./data";

type Listener = () => void;

/** Minimal subset of the Web Storage API (eases testing). */
export type KeyValueStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

/**
 * In-memory snapshot of the app data, persisted to localStorage on every
 * update. Snapshots are immutable: every update produces a new object so it
 * can be used with React's `useSyncExternalStore`.
 */
export class AppStore {
  private data: AppData | null = null;
  private listeners = new Set<Listener>();
  /** Last persistence error (e.g. quota exceeded), shown in settings. */
  lastError: string | null = null;

  constructor(
    private readonly storage: KeyValueStorage | null,
    private readonly key: string = STORAGE_KEY,
  ) {}

  get = (): AppData => {
    if (!this.data) this.data = this.load();
    return this.data;
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(fn: (data: AppData) => AppData): void {
    this.set(fn(this.get()));
  }

  replace(data: AppData): void {
    this.set(data);
  }

  clear(): void {
    this.storage?.removeItem(this.key);
    this.data = createEmptyData();
    this.emit();
  }

  exportJson(): string {
    const file: ExportFile = {
      app: EXPORT_APP_ID,
      exportedAt: new Date().toISOString(),
      data: this.get(),
    };
    return JSON.stringify(file, null, 2);
  }

  /** Imports a backup. `merge` keeps current data and adds/updates entries. */
  importJson(json: string, mode: "replace" | "merge"): AppData {
    const incoming = parseImport(json);
    const next = mode === "merge" ? mergeData(this.get(), incoming) : incoming;
    this.set(next);
    return next;
  }

  /** Re-reads storage (used when another tab changed the data). */
  reload(): void {
    this.data = this.load();
    this.emit();
  }

  private set(data: AppData): void {
    this.data = data;
    try {
      this.storage?.setItem(this.key, JSON.stringify(data));
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      console.error("Nie udało się zapisać danych w localStorage", err);
    }
    this.emit();
  }

  private load(): AppData {
    const raw = this.storage?.getItem(this.key);
    if (!raw) return createEmptyData();
    try {
      return parseData(JSON.parse(raw));
    } catch (err) {
      // Keep the unreadable data so nothing is lost, then start fresh.
      try {
        this.storage?.setItem(`${this.key}:backup-${Date.now()}`, raw);
      } catch {
        // ignore
      }
      this.lastError = err instanceof Error ? err.message : String(err);
      return createEmptyData();
    }
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

let browserStore: AppStore | null = null;

/** Singleton bound to `window.localStorage` (browser only). */
export function getStore(): AppStore {
  if (!browserStore) {
    const storage = typeof window !== "undefined" ? safeLocalStorage() : null;
    browserStore = new AppStore(storage);
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) browserStore?.reload();
      });
    }
  }
  return browserStore;
}

function safeLocalStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = `${STORAGE_KEY}:probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
