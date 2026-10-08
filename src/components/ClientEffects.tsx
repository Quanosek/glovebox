"use client";

import { useEffect } from "react";
import { useAppData } from "@/lib/storage/hooks";

/** Applies persisted settings to <html> and registers the service worker. */
export function ClientEffects() {
  const { settings } = useAppData();

  useEffect(() => {
    document.documentElement.dataset.fontSize = settings.fontSize;
  }, [settings.fontSize]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Nie udało się zarejestrować service workera", err);
    });
  }, []);

  return null;
}
