"use client";

import { useOfflineState } from "@/lib/offline";
import { useHydrated } from "@/lib/storage/hooks";
import { Skeleton } from "../Skeleton";

/** Offline copy status as one cell of the stats strip. */
export function OfflineStat({ carId }: { carId: string }) {
  const hydrated = useHydrated();
  const offline = useOfflineState();
  const progress = offline.running[carId];
  const saved = hydrated ? offline.saved[carId] : undefined;
  return (
    <a href="#bez-internetu" className="stat-cell group hover:bg-paper">
      <span className="block text-2xl leading-none font-semibold sm:text-3xl">
        {!hydrated ? (
          <Skeleton className="h-7 w-12" />
        ) : progress ? (
          `${Math.round(progress.total ? (progress.done / progress.total) * 100 : 100)}%`
        ) : saved ? (
          <span aria-hidden="true">✓</span>
        ) : (
          <span className="text-silver">–</span>
        )}
      </span>
      <span className="mt-1.5 block text-xs text-graphite">
        {progress
          ? "zapisywanie"
          : saved
            ? "działa bez internetu"
            : "bez internetu: jeszcze nie"}
      </span>
    </a>
  );
}
