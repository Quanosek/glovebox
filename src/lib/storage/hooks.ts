"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import type { FeatureState, VehicleProfile } from "@/config/vehicle";
import type { CarSummary } from "@/lib/cars";
import { isValidId } from "@/lib/slug";
import type { CarSpec } from "@/lib/catalog";
import { vehicleProfileWithEngine } from "@/lib/engines";
import { useLayoutHint } from "./hintContext";
import { historyKey } from "./migrations";
import {
  EMPTY_DATA,
  HISTORY_LIMIT,
  fixedReminderId,
  type AppData,
  type HistoryEntry,
  type Reminder,
} from "./schema";
import { getStore, newId } from "./store";

const getServerSnapshot = () => EMPTY_DATA;

/** Current app data; returns the empty snapshot during SSR / hydration. */
export function useAppData(): AppData {
  const store = getStore();
  return useSyncExternalStore(store.subscribe, store.get, getServerSnapshot);
}

/** True after hydration (data from localStorage is available). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const noopSubscribe = () => () => {};

const EMPTY_PROFILE: VehicleProfile = {};

/**
 * Equipment of a car (feature id → state). Defaults to the car of the open
 * `/auto/<car>` page; empty when nothing was marked yet.
 */
export function useVehicleProfile(carId?: string | null): VehicleProfile {
  const pathname = usePathname();
  const data = useAppData();
  const id = carId ?? /^\/auto\/([^/]+)/.exec(pathname)?.[1];
  const profile = (id && data.settings.vehicles[id]) || EMPTY_PROFILE;
  return profile;
}

export function useCarEngine(carId: string): CarSpec | null {
  const data = useAppData();
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  return (
    (hydrated ? data.settings.engines[carId] : hint.engines[carId]) ?? null
  );
}

export function setCarEngine(carId: string, engine: CarSpec | null): void {
  updateData((d) => ({
    ...d,
    settings: {
      ...d.settings,
      engines: { ...d.settings.engines, [carId]: engine },
      vehicles: {
        ...d.settings.vehicles,
        [carId]: vehicleProfileWithEngine(
          d.settings.vehicles[carId] ?? {},
          engine,
        ),
      },
    },
  }));
}

/** Old car files are read only once as a compatibility hint; never written back. */
export function initializeCarEngine(carId: string, legacy?: CarSpec): void {
  updateData((d) =>
    Object.hasOwn(d.settings.engines, carId)
      ? d
      : {
          ...d,
          settings: {
            ...d.settings,
            engines: { ...d.settings.engines, [carId]: legacy ?? null },
            vehicles: {
              ...d.settings.vehicles,
              [carId]: vehicleProfileWithEngine(
                d.settings.vehicles[carId] ?? {},
                legacy,
              ),
            },
          },
        },
  );
}

/** Sets (or with `null` clears) the state of one feature of a car. */
export function setFeatureState(
  carId: string,
  featureId: string,
  state: FeatureState | null,
): void {
  updateData((d) => {
    const profile = { ...d.settings.vehicles[carId] };
    if (state) profile[featureId] = state;
    else delete profile[featureId];
    const vehicles = { ...d.settings.vehicles };
    if (Object.keys(profile).length > 0) vehicles[carId] = profile;
    else delete vehicles[carId];
    return { ...d, settings: { ...d.settings, vehicles } };
  });
}

/** Replaces the whole equipment profile of a car. */
export function setVehicleProfile(
  carId: string,
  profile: VehicleProfile,
): void {
  updateData((d) => {
    const vehicles = { ...d.settings.vehicles };
    if (Object.keys(profile).length > 0) vehicles[carId] = { ...profile };
    else delete vehicles[carId];
    return { ...d, settings: { ...d.settings, vehicles } };
  });
}

/** Adds a car from the shared manuals library to this browser profile. */
export function addOwnedCar(carId: string): void {
  if (!isValidId(carId)) return;
  updateData((d) =>
    d.settings.ownedCars.includes(carId)
      ? d
      : {
          ...d,
          settings: {
            ...d.settings,
            ownedCars: [...d.settings.ownedCars, carId],
            // A new assignment must not inherit an engine from another owner's legacy manuals.
            engines: Object.hasOwn(d.settings.engines, carId)
              ? d.settings.engines
              : { ...d.settings.engines, [carId]: null },
          },
        },
  );
}

/** Removes a car from this browser profile without deleting its manuals. */
export function removeOwnedCar(carId: string): void {
  if (!isValidId(carId)) return;
  updateData((d) => ({
    ...d,
    settings: {
      ...d.settings,
      activeCar: d.settings.activeCar === carId ? null : d.settings.activeCar,
      ownedCars: d.settings.ownedCars.filter((id) => id !== carId),
    },
  }));
}

export function updateData(fn: (data: AppData) => AppData): void {
  getStore().update(fn);
}

/**
 * Car currently in use: the car of the open `/auto/<car>` page, otherwise
 * the one chosen on the profile page (from the layout hint before hydration).
 */
export function useActiveCar(cars: CarSummary[]): CarSummary | null {
  const pathname = usePathname();
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const fromPath = /^\/auto\/([^/]+)/.exec(pathname)?.[1];
  const id = fromPath ?? (hydrated ? settings.activeCar : hint.activeCar);
  return cars.find((c) => c.id === id) ?? null;
}

export function setActiveCar(id: string | null): void {
  updateData((d) =>
    d.settings.activeCar === id
      ? d
      : { ...d, settings: { ...d.settings, activeCar: id } },
  );
}

/** Puts a section at the top of the reading history (one entry per section). */
export function recordReading(entry: Omit<HistoryEntry, "at">): void {
  updateData((d) => {
    const key = historyKey(entry);
    return {
      ...d,
      history: [
        { ...entry, at: new Date().toISOString() },
        ...d.history.filter((h) => historyKey(h) !== key),
      ].slice(0, HISTORY_LIMIT),
    };
  });
}

/** Removes a bookmark (it also leaves the favourites bar of its car). */
export function withoutBookmark(d: AppData, bookmarkId: string): AppData {
  return { ...d, bookmarks: d.bookmarks.filter((b) => b.id !== bookmarkId) };
}

export function saveReminder(
  reminder: Omit<Reminder, "id" | "createdAt" | "updatedAt" | "eventDate"> & {
    id?: string;
    eventDate?: string | null;
  },
): void {
  const now = new Date().toISOString();
  updateData((d) => {
    const existing = reminder.id
      ? d.reminders.find((r) => r.id === reminder.id)
      : undefined;
    const id =
      reminder.kind === "custom"
        ? (existing?.id ?? newId())
        : fixedReminderId(reminder.kind, reminder.car);
    const fixed = d.reminders.find((r) => r.id === id);
    const next: Reminder = {
      ...reminder,
      eventDate: reminder.eventDate ?? null,
      id,
      createdAt: (existing ?? fixed)?.createdAt ?? now,
      updatedAt: now,
    };
    return {
      ...d,
      reminders: d.reminders.some((r) => r.id === id)
        ? d.reminders.map((r) => (r.id === id ? next : r))
        : [...d.reminders, next],
    };
  });
}

export function deleteReminder(id: string): void {
  updateData((d) => ({
    ...d,
    reminders: d.reminders.filter((r) => r.id !== id),
  }));
}
