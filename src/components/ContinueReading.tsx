"use client";

import Link from "next/link";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { RESTORE_SCROLL_KEY } from "./ReadingTracker";
import { Skeleton } from "./Skeleton";

/** Last read section; with `car`, only when it belongs to that car. */
export function ContinueReading({
  car,
  carLabel,
}: {
  car?: string;
  carLabel?: string;
}) {
  const { lastRead, history } = useAppData();
  const hydrated = useHydrated();
  if (!hydrated)
    return (
      <div className="panel" aria-busy="true">
        <div className="panel-title">
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
      </div>
    );
  if (!lastRead || (car && lastRead.car !== car)) return null;
  const thumb = history.find((h) => h.href === lastRead.href)?.thumb ?? null;

  return (
    <div className="panel">
      <div className="panel-title">Czytaj dalej</div>
      <div className="flex flex-wrap items-center gap-4 p-4">
        {thumb && (
          <span className="thumb h-20 w-28 shrink-0 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- local manual illustration */}
            <img src={thumb} alt="" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-snug font-semibold">{lastRead.title}</p>
          <p className="text-xs text-steel">
            {carLabel ? `${carLabel} · ` : ""}
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
