"use client";

import { useState } from "react";

type Permission = NotificationPermission | "unsupported";

export function ReminderNotifications() {
  const [permission, setPermission] = useState<Permission>("default");

  const enable = async () => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next === "granted")
        window.dispatchEvent(new Event("reminders-notification-permission"));
    } catch {
      setPermission("unsupported");
    }
  };

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
        disabled={permission === "granted" || permission === "unsupported"}
        onClick={() => void enable()}
      >
        {permission === "granted"
          ? "Powiadomienia włączone"
          : permission === "denied"
            ? "Zablokowano powiadomienia"
            : permission === "unsupported"
              ? "Niedostępne w tej przeglądarce"
              : "Włącz powiadomienia"}
      </button>
    </section>
  );
}
