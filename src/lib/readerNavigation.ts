import { RESERVED_BOOK_ROUTES } from "@/lib/cars";
import { isValidId } from "@/lib/slug";
import { STORAGE_KEY } from "@/lib/storage/schema";

export interface ReaderTrail {
  pages: string[];
  pending: string | null;
  floor: number;
}
export interface ReaderEntry {
  path: string;
  index: number;
}
const KEY = `${STORAGE_KEY}:reader-navigation`;
const EMPTY: ReaderTrail = { pages: [], pending: null, floor: -1 };
const memory: Record<string, ReaderTrail> = {};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function readerCar(path: string): string | null {
  const match = /^\/auto\/([^/]+)\/([^/?#]+)/.exec(path);
  return match &&
    isValidId(match[1]) &&
    isValidId(match[2]) &&
    !RESERVED_BOOK_ROUTES.includes(match[2])
    ? match[1]
    : null;
}

export function recordReaderPage(
  trail: ReaderTrail,
  path: string,
): ReaderTrail {
  if (trail.pending === path) return { ...trail, pending: null };
  return {
    ...trail,
    pending: null,
    pages: trail.pages.at(-1) === path ? trail.pages : [...trail.pages, path],
  };
}

export function previousReaderEntry(
  entries: ReaderEntry[],
  index: number,
  path: string,
  floor: number,
): ReaderEntry | null {
  return (
    entries
      .filter(
        (entry) =>
          entry.index < index &&
          entry.index >= floor &&
          entry.path !== path &&
          readerCar(entry.path) === readerCar(path),
      )
      .sort((a, b) => b.index - a.index)[0] ?? null
  );
}

export function consumeReaderTrail(
  trail: ReaderTrail,
  path: string,
  bookIndex: string,
): { trail: ReaderTrail; target: string } {
  const pages = [...trail.pages];
  if (pages.at(-1) === path) pages.pop();
  const target =
    pages.at(-1) ??
    (path === bookIndex ? `/auto/${readerCar(path)}` : bookIndex);
  return {
    target,
    trail: {
      ...trail,
      pages: pages.length ? pages : target === bookIndex ? [bookIndex] : [],
      pending: target,
    },
  };
}

function load(car: string): ReaderTrail {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
    if (isObject(raw)) {
      // Keep trails of every car when this tab visits another vehicle.
      for (const [id, value] of Object.entries(raw)) {
        if (!isValidId(id) || !isObject(value) || !Array.isArray(value.pages))
          continue;
        memory[id] = {
          pages: value.pages.filter(
            (path): path is string =>
              typeof path === "string" && readerCar(path) === id,
          ),
          pending: typeof value.pending === "string" ? value.pending : null,
          floor:
            typeof value.floor === "number" && Number.isInteger(value.floor)
              ? value.floor
              : -1,
        };
      }
    }
  } catch (err) {
    console.warn("Nie udało się odczytać historii instrukcji.", err);
  }
  return memory[car] ?? EMPTY;
}

function save(car: string, trail: ReaderTrail) {
  memory[car] = trail;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch (err) {
    console.warn("Nie udało się zapisać historii instrukcji.", err);
  }
}

export function trackReaderPage(path: string) {
  const car = readerCar(path);
  if (car) save(car, recordReaderPage(load(car), path));
}

/** Use the public Navigation API to skip non-reader entries and in-page anchors exactly. */
function browserEntries(): { entries: ReaderEntry[]; index: number } | null {
  const navigation = "navigation" in window ? window.navigation : null;
  if (
    !navigation ||
    typeof navigation !== "object" ||
    !("entries" in navigation) ||
    typeof navigation.entries !== "function" ||
    !("currentEntry" in navigation)
  )
    return null;
  const current: unknown = navigation.currentEntry;
  if (
    !current ||
    typeof current !== "object" ||
    !("index" in current) ||
    typeof current.index !== "number"
  )
    return null;
  const entries: unknown = navigation.entries();
  if (!Array.isArray(entries)) return null;
  return {
    index: current.index,
    entries: entries.flatMap((entry: unknown) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !("url" in entry) ||
        typeof entry.url !== "string" ||
        !("index" in entry) ||
        typeof entry.index !== "number"
      )
        return [];
      const url = new URL(entry.url);
      return url.origin === window.location.origin
        ? [{ path: url.pathname, index: entry.index }]
        : [];
    }),
  };
}

/** Returns a route only when native traversal is unavailable or the reader trail is exhausted. */
export function goReaderBack(path: string, bookIndex: string): string | null {
  const car = readerCar(path);
  if (!car)
    throw new Error(
      "Przycisk instrukcji jest dostępny tylko podczas czytania.",
    );
  const trail = load(car);
  const native = browserEntries();
  if (native) {
    const previous = previousReaderEntry(
      native.entries,
      native.index,
      path,
      trail.floor,
    );
    if (previous) {
      save(car, {
        ...trail,
        pages: trail.pages.slice(
          0,
          Math.max(0, trail.pages.lastIndexOf(previous.path) + 1),
        ),
        pending: previous.path,
      });
      window.history.go(previous.index - native.index);
      return null;
    }
    // The book index starts a new boundary instead of revisiting exhausted history.
    const target = path === bookIndex ? `/auto/${car}` : bookIndex;
    save(car, {
      pages: target === bookIndex ? [bookIndex] : [],
      pending: target,
      floor: native.index + 1,
    });
    return target;
  }
  const consumed = consumeReaderTrail(trail, path, bookIndex);
  save(car, consumed.trail);
  return consumed.target;
}
