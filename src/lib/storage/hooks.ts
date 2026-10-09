"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import type { FeatureState, VehicleProfile } from "@/config/vehicle";
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

const EMPTY_PROFILE: VehicleProfile = {};

/**
 * Equipment of a car (feature id → state). Defaults to the car of the open
 * `/auto/<car>` page; empty when nothing was marked yet.
 */
export function useVehicleProfile(carId?: string | null): VehicleProfile {
  const pathname = usePathname();
  const data = useAppData();
  const id = carId ?? /^\/auto\/([^/]+)/.exec(pathname)?.[1];
  return (id && data.settings.vehicles[id]) || EMPTY_PROFILE;
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
  updateData((d) =>
    d.settings.ownedCars.includes(carId)
      ? d
      : {
          ...d,
          settings: {
            ...d.settings,
            ownedCars: [...d.settings.ownedCars, carId],
          },
        },
  );
}

/** Removes a car from this browser profile without deleting its manuals. */
export function removeOwnedCar(carId: string): void {
  updateData((d) => ({
    ...d,
    settings: {
      ...d.settings,
      activeCar:
        d.settings.activeCar === carId ? null : d.settings.activeCar,
      ownedCars: d.settings.ownedCars.filter((id) => id !== carId),
    },
  }));
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
