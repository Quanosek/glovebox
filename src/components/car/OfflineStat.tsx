"use client";

import { useOfflineState } from "@/lib/offline";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { useHydrated } from "@/lib/storage/hooks";

/** Offline copy status as one cell of the stats strip. */
export function OfflineStat({ carId }: { carId: string }) {
  const hydrated = useHydrated();
  const offline = useOfflineState();
  const progress = offline.running[carId];
  const hint = useLayoutHint();
  const saved = hydrated
    ? Boolean(offline.saved[carId])
    : hint.offline.includes(carId);
  return (
    <a href="#bez-internetu" className="stat-cell group hover:bg-paper">
      <span className="type-value block">
        {progress ? (
          `${Math.round(progress.total ? (progress.done / progress.total) * 100 : 100)}%`
        ) : saved ? (
          <>
            <span aria-hidden="true">✓</span>
            <span className="sr-only">tak</span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="text-silver">
              –
            </span>
            <span className="sr-only">nie</span>
          </>
        )}
      </span>
      <span className="mt-1.5 block text-xs text-graphite">
        {progress ? "zapisywanie" : "dostęp bez internetu"}{" "}
        <span aria-hidden="true" className="text-red">
          ›
        </span>
      </span>
    </a>
  );
}
