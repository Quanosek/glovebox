"use client";

import { saveCarOffline, useOfflineState, useOnline } from "@/lib/offline";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { useHydrated } from "@/lib/storage/hooks";
import { Skeleton } from "./Skeleton";

/**
 * Offline copy of the car, the last tile of the car page's side column. The
 * stats strip at the top only shows the status and links here (`#bez-internetu`).
 */
export function CarActions({ carId }: { carId: string }) {
  const hydrated = useHydrated();
  const online = useOnline();
  const offline = useOfflineState();
  const hint = useLayoutHint();
  const saved = hydrated ? offline.saved[carId] : undefined;
  // Before hydration the hint tells whether a copy exists (date unknown yet).
  const hasCopy = hydrated ? Boolean(saved) : hint.offline.includes(carId);
  const progress = offline.running[carId];
  const offlineError = offline.errors[carId];
  return (
    <section
      id="bez-internetu"
      className="panel"
      aria-labelledby="car-offline-title"
    >
      <h2 id="car-offline-title" className="panel-title">
        Bez internetu
      </h2>
      <div className="space-y-3 p-4 text-sm">
        <div aria-live="polite">
          {progress ? (
            <>
              <p className="font-semibold">
                Zapisywanie do czytania bez internetu…
              </p>
              <div className="mt-2 h-1.5 w-full bg-line">
                <div
                  className="h-full bg-red transition-[width]"
                  style={{
                    width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-graphite">
                {Math.round(
                  progress.total ? (progress.done / progress.total) * 100 : 100,
                )}
                % – możesz w tym czasie normalnie czytać.
              </p>
            </>
          ) : hasCopy ? (
            <p>
              <span className="badge badge-dark mr-2">Gotowe</span>
              Instrukcje tego auta działają także bez internetu (zapisano{" "}
              {saved ? (
                new Date(saved.savedAt).toLocaleDateString("pl-PL")
              ) : (
                <Skeleton className="inline-block h-4 w-20 align-middle" />
              )}
              ).
            </p>
          ) : (
            <p className="text-graphite">
              Po otwarciu auta jego instrukcje zapisują się same, aby można je
              było czytać bez internetu.
            </p>
          )}
          {offlineError && !progress && (
            <p className="mt-2 text-red">{offlineError}</p>
          )}
          {!online && (
            <p className="mt-2 text-xs text-steel">
              Nie ma internetu – zapisane instrukcje działają, ale nie można ich
              teraz odświeżyć.
            </p>
          )}
        </div>
        {!progress && (
          <button
            type="button"
            className="btn"
            disabled={!online}
            onClick={() => void saveCarOffline(carId, { force: true })}
          >
            {hasCopy ? "Zapisz ponownie" : "Zapisz teraz"}
          </button>
        )}
      </div>
    </section>
  );
}
