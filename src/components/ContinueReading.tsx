"use client";

import Link from "next/link";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { RESTORE_SCROLL_KEY } from "./ReadingTracker";

export function ContinueReading() {
  const { lastRead } = useAppData();
  const hydrated = useHydrated();
  if (!hydrated || !lastRead) return null;

  return (
    <div className="panel">
      <div className="panel-title">Ostatnio czytane</div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold">{lastRead.title}</p>
          <p className="text-xs text-steel">
            {new Date(lastRead.at).toLocaleString("pl-PL")}
          </p>
        </div>
        <Link
          href={lastRead.href}
          className="btn btn-primary"
          onClick={() => {
            try {
              sessionStorage.setItem(
                RESTORE_SCROLL_KEY,
                String(lastRead.scrollY),
              );
            } catch {
              // ignore
            }
          }}
        >
          Kontynuuj czytanie
        </Link>
      </div>
    </div>
  );
}
