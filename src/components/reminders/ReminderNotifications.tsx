"use client";

import { useSyncExternalStore } from "react";

type Permission = NotificationPermission | "unsupported";

function subscribe(callback: () => void) {
  window.addEventListener("reminders-notification-permission", callback);
  return () =>
    window.removeEventListener("reminders-notification-permission", callback);
}

function getPermission(): Permission {
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission;
}

export function ReminderNotifications() {
  const permission = useSyncExternalStore<Permission | null>(
    subscribe,
    getPermission,
    () => null,
  );

  const enable = async () => {
    if (typeof Notification === "undefined") return;
    try {
      await Notification.requestPermission();
      window.dispatchEvent(new Event("reminders-notification-permission"));
    } catch {
      return;
    }
  };

  if (permission === null || permission === "granted") return null;

  return (
    <section className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="type-item">Powiadomienia o terminach</h2>
        <p className="mt-1 text-sm text-graphite">
          Pojawią się, gdy aplikacja jest otwarta i termin zbliża się w ciągu 30
          dni.
        </p>
      </div>
      <button
        type="button"
        className="btn shrink-0 justify-center"
        disabled={permission === "unsupported"}
        onClick={() => void enable()}
      >
        {permission === "denied"
          ? "Zablokowano powiadomienia"
          : permission === "unsupported"
            ? "Niedostępne w tej przeglądarce"
            : "Włącz powiadomienia"}
      </button>
    </section>
  );
}
