"use client";

import { useSyncExternalStore } from "react";

/**
 * Offline copies of cars (Cache API). Opening a car saves all its pages,
 * illustrations, search index and the scripts/styles those pages need into
 * OFFLINE_CACHE, which `public/sw.js` answers from when the server cannot be
 * reached. Which car was saved (and for which content version) is kept in
 * localStorage under STATUS_KEY so unchanged cars are not downloaded again.
 */

/** Name of the Cache API cache shared with `public/sw.js`. */
export const OFFLINE_CACHE = "opel-cascada-manual-offline-v1";
const STATUS_KEY = "opel-cascada-manual:offline";
const WORKERS = 3;

export interface OfflineEntry {
  version: string;
  savedAt: string;
  total: number;
}

export interface OfflineProgress {
  done: number;
  total: number;
  failed: number;
}

export interface OfflineState {
  saved: Record<string, OfflineEntry>;
  running: Record<string, OfflineProgress>;
  errors: Record<string, string>;
}

const EMPTY: OfflineState = { saved: {}, running: {}, errors: {} };
let state: OfflineState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
const jobs = new Map<string, Promise<void>>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    const saved = raw ? (JSON.parse(raw) as Record<string, OfflineEntry>) : {};
    if (saved && typeof saved === "object") state = { ...state, saved };
  } catch {
    // unreadable status only means cars get saved again
  }
}

function set(next: Partial<OfflineState>) {
  state = { ...state, ...next };
  if (next.saved) {
    try {
      window.localStorage.setItem(STATUS_KEY, JSON.stringify(state.saved));
    } catch {
      // storage full: the copy still works, it is just re-checked next time
    }
  }
  for (const l of listeners) l();
}

function without<T>(rec: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...rec };
  delete copy[key];
  return copy;
}

/** True when this browser can keep offline copies (needs a secure origin). */
export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

const STATIC_ASSET = /(?:src|href)="(\/_next\/static\/[^"?#]+)"/g;

/**
 * Saves every URL of a car into OFFLINE_CACHE. Skips the download when the
 * stored copy matches the server's content version unless `force` is set.
 */
export function saveCarOffline(
  carId: string,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  load();
  const running = jobs.get(carId);
  if (running) return running;
  const job = run(carId, force).finally(() => jobs.delete(carId));
  jobs.set(carId, job);
  return job;
}

async function run(carId: string, force: boolean) {
  if (!offlineSupported()) {
    set({
      errors: {
        ...state.errors,
        [carId]: "Ta przeglądarka nie pozwala zapisać instrukcji na później.",
      },
    });
    return;
  }
  set({ errors: without(state.errors, carId) });
  let manifest: { version: string; urls: string[] };
  try {
    const res = await fetch(`/api/cars/${carId}/offline`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error();
    manifest = (await res.json()) as typeof manifest;
  } catch {
    if (!force) return; // offline or server gone: keep the existing copy
    set({
      errors: {
        ...state.errors,
        [carId]: "Brak połączenia z aplikacją — spróbuj ponownie później.",
      },
    });
    return;
  }

  const cache = await caches.open(OFFLINE_CACHE);
  const known = state.saved[carId];
  if (
    !force &&
    known?.version === manifest.version &&
    (await cache.match(manifest.urls[0] ?? `/auto/${carId}`))
  )
    return;

  const queue = [...manifest.urls];
  const seen = new Set(queue);
  const progress: OfflineProgress = { done: 0, total: queue.length, failed: 0 };
  const report = () =>
    set({ running: { ...state.running, [carId]: { ...progress } } });
  report();

  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        const res = await fetch(url, {
          credentials: "same-origin",
          cache: "no-cache",
        });
        if (!res.ok || res.redirected) throw new Error();
        if ((res.headers.get("Content-Type") ?? "").includes("text/html")) {
          // Pages need their scripts and styles to work offline too.
          const html = await res.clone().text();
          for (const m of html.matchAll(STATIC_ASSET)) {
            if (seen.has(m[1])) continue;
            seen.add(m[1]);
            queue.push(m[1]);
            progress.total++;
          }
        }
        await cache.put(url, res);
      } catch {
        progress.failed++;
      }
      progress.done++;
      report();
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));

  const runningNow = without(state.running, carId);
  if (progress.failed) {
    set({
      running: runningNow,
      errors: {
        ...state.errors,
        [carId]: `Nie udało się zapisać ${progress.failed} z ${progress.total} elementów. Zostaną pobrane przy następnej wizycie.`,
      },
    });
  } else {
    set({
      running: runningNow,
      saved: {
        ...state.saved,
        [carId]: {
          version: manifest.version,
          savedAt: new Date().toISOString(),
          total: progress.total,
        },
      },
    });
  }
}

/** Removes a car's offline copy (pages and illustrations) and its status. */
export async function forgetCarOffline(carId: string): Promise<void> {
  load();
  set({
    saved: without(state.saved, carId),
    errors: without(state.errors, carId),
  });
  if (!offlineSupported()) return;
  const cache = await caches.open(OFFLINE_CACHE);
  for (const req of await cache.keys()) {
    const { pathname, search } = new URL(req.url);
    if (
      pathname === `/auto/${carId}` ||
      pathname.startsWith(`/auto/${carId}/`) ||
      pathname.startsWith(`/media/${carId}/`) ||
      (pathname === "/api/search-index" && search === `?car=${carId}`)
    )
      await cache.delete(req);
  }
}

/** Forgets all offline status (used after the caches were cleared). */
export function resetOfflineStatus(): void {
  load();
  set({ saved: {}, errors: {} });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => {
  load();
  return state;
};
const getServerSnapshot = () => EMPTY;

export function useOfflineState(): OfflineState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ----------------------------------------------------- connection state */

const subscribeOnline = (l: () => void) => {
  window.addEventListener("online", l);
  window.addEventListener("offline", l);
  return () => {
    window.removeEventListener("online", l);
    window.removeEventListener("offline", l);
  };
};

/** `navigator.onLine`; true during SSR/hydration. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
