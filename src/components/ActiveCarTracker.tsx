"use client";

import { useEffect } from "react";
import { offlineSupported, saveCarOffline } from "@/lib/offline";
import { setActiveCar, useHydrated } from "@/lib/storage/hooks";

/**
 * Makes the car of the open page the active car of the profile and, in the
 * background, keeps an offline copy of that car up to date.
 */
export function ActiveCarTracker({ car }: { car: string }) {
  const hydrated = useHydrated();
  useEffect(() => {
    if (!hydrated) return;
    setActiveCar(car);
    // The service worker (and so offline reading) only exists in production.
    if (process.env.NODE_ENV !== "production" || !offlineSupported()) return;
    const timer = window.setTimeout(() => {
      if (navigator.onLine) void saveCarOffline(car);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [car, hydrated]);
  return null;
}
