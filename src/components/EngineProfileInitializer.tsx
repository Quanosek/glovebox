"use client";

import { useEffect } from "react";
import type { CarSummary } from "@/lib/cars";
import {
  initializeCarEngine,
  useAppData,
  useHydrated,
} from "@/lib/storage/hooks";

/** Transfer legacy selections only for cars already assigned to this browser. */
export function EngineProfileInitializer({ cars }: { cars: CarSummary[] }) {
  const { settings } = useAppData();
  const hydrated = useHydrated();
  useEffect(() => {
    if (!hydrated) return;
    for (const car of cars) {
      if (
        settings.ownedCars.includes(car.id) &&
        !Object.hasOwn(settings.engines, car.id)
      )
        initializeCarEngine(car.id, car.spec);
    }
  }, [cars, hydrated, settings.engines, settings.ownedCars]);
  return null;
}
