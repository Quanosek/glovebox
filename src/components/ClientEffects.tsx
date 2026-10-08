"use client";

import { useEffect } from "react";
import { useAppData } from "@/lib/storage/hooks";
import { watchTypography } from "@/lib/typographyDom";

/** Applies persisted settings to <html> and registers the service worker. */
export function ClientEffects() {
  const { settings } = useAppData();

  useEffect(() => {
    document.documentElement.dataset.fontSize = settings.fontSize;
  }, [settings.fontSize]);

  // Polish line breaks (no one-letter words at line ends) for all UI text.
  useEffect(() => watchTypography(), []);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Nie udało się zarejestrować service workera", err);
    });
  }, []);

  return null;
}
