"use client";

import { useEffect } from "react";
import { useOfflineState } from "@/lib/offline";
import { HINT_COOKIE, buildHint, serializeHint } from "@/lib/storage/hint";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { watchTypography } from "@/lib/typographyDom";

/** Applies persisted settings to <html> and registers the service worker. */
export function ClientEffects() {
  const data = useAppData();
  const { settings } = data;
  const hydrated = useHydrated();
  const { saved } = useOfflineState();

  useEffect(() => {
    document.documentElement.dataset.fontSize = settings.fontSize;
  }, [settings.fontSize]);

  // Layout hint for the next server render (no layout jumps on load).
  useEffect(() => {
    if (!hydrated) return;
    const value = serializeHint(buildHint(data, Object.keys(saved)));
    document.cookie = `${HINT_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Strict`;
  }, [hydrated, data, saved]);

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
