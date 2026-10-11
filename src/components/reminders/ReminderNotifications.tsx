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

  // The permission is only known in the browser. Until then the panel keeps
  // its usual box (most browsers have not answered yet); it is placed after
  // the reminders, so hiding it once notifications are on moves nothing.
  if (permission === "granted") return null;

  return (
    <section
      className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-busy={permission === null}
    >
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
        disabled={permission === null || permission === "unsupported"}
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
