"use client";

import { useEffect } from "react";
import { useOfflineState } from "@/lib/offline";
import { HINT_COOKIE, buildHint, serializeHint } from "@/lib/storage/hint";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { watchTypography } from "@/lib/typographyDom";
import { dueSoon, formatDate, todayIso } from "@/lib/reminders";

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

  useEffect(() => {
    if (!hydrated || typeof Notification === "undefined") return;
    const notify = () => {
      if (Notification.permission !== "granted") return;
      let sent: Record<string, string> = {};
      try {
        sent = JSON.parse(
          localStorage.getItem("opel-cascada-manual:notifications") ?? "{}",
        ) as Record<string, string>;
      } catch {
        // A broken notification log must not prevent reminders from appearing.
      }
      const currentIds = new Set(
        data.reminders.filter((reminder) => reminder.dueDate).map((r) => r.id),
      );
      sent = Object.fromEntries(
        Object.entries(sent).filter(([id]) => currentIds.has(id)),
      );
      const due = dueSoon(data.reminders, todayIso(), settings.ownedCars);
      for (const reminder of due) {
        if (sent[reminder.id] === reminder.dueDate) continue;
        sent[reminder.id] = reminder.dueDate!;
        const options = {
          body: `Termin: ${formatDate(reminder.dueDate!)}.`,
          tag: reminder.id,
          data: { car: reminder.car },
        };
        const showFallback = () => {
          try {
            const notification = new Notification(reminder.title, options);
            notification.onclick = () => {
              window.focus();
              window.location.href = `/przypomnienia#${reminder.car}`;
            };
          } catch {
            // Notifications may be unavailable even when the API is present.
          }
        };
        void navigator.serviceWorker
          ?.getRegistration()
          .then((registration) =>
            registration
              ? registration.showNotification(reminder.title, options)
              : showFallback(),
          )
          .catch(showFallback);
      }
      try {
        localStorage.setItem(
          "opel-cascada-manual:notifications",
          JSON.stringify(sent),
        );
      } catch {
        // Reminders continue to work in the app if notification state cannot persist.
      }
    };
    notify();
    const interval = window.setInterval(notify, 60 * 60 * 1000);
    window.addEventListener("focus", notify);
    window.addEventListener("reminders-notification-permission", notify);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", notify);
      window.removeEventListener("reminders-notification-permission", notify);
    };
  }, [data.reminders, hydrated, settings.ownedCars]);

  return null;
}
