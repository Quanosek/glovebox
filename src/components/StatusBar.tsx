"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CarSummary } from "@/lib/cars";
import { useOfflineState, useOnline } from "@/lib/offline";
import { useHydrated } from "@/lib/storage/hooks";

function useClock(enabled: boolean): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

/**
 * Thin Navi 950-like status line under the header: active car, its copy on
 * this device, the connection and the date and time. Everything is local;
 * nothing here makes a network request.
 */
export function StatusBar({ car }: { car: CarSummary | null }) {
  const hydrated = useHydrated();
  const online = useOnline();
  const offline = useOfflineState();
  const now = useClock(hydrated);
  const progress = car ? offline.running[car.id] : undefined;
  const saved = car && hydrated ? offline.saved[car.id] : undefined;

  const copy = progress
    ? `Zapisywanie na urządzeniu: ${Math.round(progress.total ? (progress.done / progress.total) * 100 : 100)}%`
    : saved
      ? "Zapisane na tym urządzeniu"
      : null;

  return (
    <div className="status-bar">
      <div className="mx-auto flex h-7 max-w-app items-center gap-4 px-3 text-xs lg:px-5">
        {car && (
          <Link
            href={car.href}
            className="hidden min-w-0 truncate font-semibold text-ink hover:text-red sm:block"
          >
            {car.brand} {car.model} {car.year}
          </Link>
        )}
        {car && copy && (
          <span className="hidden truncate text-graphite md:inline">
            {copy}
          </span>
        )}
        <span
          className={`flex shrink-0 items-center gap-1.5 ${online ? "text-graphite" : "font-semibold text-red"}`}
          title={
            online
              ? undefined
              : "Brak internetu – działają instrukcje zapisane na tym urządzeniu"
          }
        >
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 ${online ? "bg-steel" : "bg-red"}`}
          />
          {online ? "Połączono" : "Bez internetu"}
        </span>
        <span className="ml-auto shrink-0 text-graphite tabular-nums">
          {now && (
            <>
              <span className="hidden sm:inline">
                {now.toLocaleDateString("pl-PL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                {" · "}
              </span>
              <time
                dateTime={now.toISOString()}
                className="font-semibold text-ink"
              >
                {now.toLocaleTimeString("pl-PL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
