"use client";

import { useSyncExternalStore } from "react";
import { resolveProfile, type VehicleProfile } from "@/config/vehicle";
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
