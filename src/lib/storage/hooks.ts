"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { resolveProfile, type VehicleProfile } from "@/config/vehicle";
import type { CarSummary } from "@/lib/cars";
import { EMPTY_DATA, type AppData } from "./schema";
import { getStore } from "./store";

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

export function useVehicleProfile(): VehicleProfile {
  const data = useAppData();
  return resolveProfile(data.settings.vehicle);
}

export function updateData(fn: (data: AppData) => AppData): void {
  getStore().update(fn);
}

/**
 * Car currently in use: the car of the open `/auto/<car>` page, otherwise
 * the one chosen on the profile page. Null before hydration.
 */
export function useActiveCar(cars: CarSummary[]): CarSummary | null {
  const pathname = usePathname();
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const fromPath = /^\/auto\/([^/]+)/.exec(pathname)?.[1];
  const id = fromPath ?? (hydrated ? settings.activeCar : null);
  return cars.find((c) => c.id === id) ?? null;
}

export function setActiveCar(id: string | null): void {
  updateData((d) =>
    d.settings.activeCar === id
      ? d
      : { ...d, settings: { ...d.settings, activeCar: id } },
  );
}
