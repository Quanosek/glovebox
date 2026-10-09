"use client";

import Link from "next/link";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { formatWhen } from "@/lib/storage/hint";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { RESTORE_SCROLL_KEY } from "./ReadingTracker";

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
  const hint = useLayoutHint();
  // Before hydration the hint holds exactly what is shown below.
  const view = hydrated
    ? lastRead && {
        car: lastRead.car,
        title: lastRead.title,
        href: lastRead.href,
        when: formatWhen(lastRead.at),
        thumb: history.find((h) => h.href === lastRead.href)?.thumb ?? null,
      }
    : hint.lastRead;
  if (!view || (car && view.car !== car)) return null;

  return (
    <div className="panel">
      <div className="panel-title">Czytaj dalej</div>
      <div className="flex flex-wrap items-center gap-4 p-4">
        {view.thumb && (
          <span className="thumb h-20 w-28 shrink-0 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- local manual illustration */}
            <img src={view.thumb} alt="" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="type-item">{view.title}</p>
          <p className="text-xs text-steel">
            {carLabel ? `${carLabel} · ` : ""}
            {view.when}
          </p>
        </div>
        <Link
          href={view.href}
          className="btn btn-primary"
          onClick={() => {
            if (!lastRead) return;
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
