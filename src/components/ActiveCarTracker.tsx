"use client";

import { useEffect } from "react";
import { setActiveCar, useHydrated } from "@/lib/storage/hooks";

/** Makes the car of the open page the active car of the profile. */
export function ActiveCarTracker({ car }: { car: string }) {
  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated) setActiveCar(car);
  }, [car, hydrated]);
  return null;
}
