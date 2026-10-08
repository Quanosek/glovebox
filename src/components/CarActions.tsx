"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setActiveCar, useAppData } from "@/lib/storage/hooks";

/** Name of the Cache API cache shared with `public/sw.js`. */
export const OFFLINE_CACHE = "opel-cascada-manual-offline-v1";

/** "Save for offline" and "delete car" actions of the car page. */
export function CarActions({
  carId,
  label,
  builtIn,
}: {
  carId: string;
  label: string;
  builtIn: boolean;
}) {
  const router = useRouter();
  const { settings } = useAppData();
  const [offline, setOffline] = useState<{
    done: number;
    total: number;
    failed: number;
    running: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const saveOffline = async () => {
    setError(null);
    if (typeof caches === "undefined") {
      setError("Ta przeglądarka nie obsługuje pamięci podręcznej (Cache API).");
      return;
    }
    try {
      const res = await fetch(`/api/cars/${carId}/offline`);
      if (!res.ok) throw new Error();
      const { urls } = (await res.json()) as { urls: string[] };
      const cache = await caches.open(OFFLINE_CACHE);
      const state = { done: 0, total: urls.length, failed: 0, running: true };
      setOffline({ ...state });
      const queue = [...urls];
      const worker = async () => {
        for (let url = queue.shift(); url; url = queue.shift()) {
          try {
            const r = await fetch(url, { credentials: "same-origin" });
            if (r.ok) await cache.put(url, r);
            else state.failed++;
          } catch {
            state.failed++;
          }
          state.done++;
          setOffline({ ...state });
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      setOffline({ ...state, running: false });
    } catch {
      setError("Nie udało się pobrać listy stron do zapisania.");
      setOffline(null);
    }
  };

  const remove = async () => {
    if (
      !confirm(
        `Usunąć auto „${label}” wraz z całą wygenerowaną treścią z folderu database/${carId}/? Tej operacji nie można cofnąć (chyba że folder jest zapisany w git).`,
      )
    )
      return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/cars/${carId}`, { method: "DELETE" });
    if (res.ok) {
      if (settings.activeCar === carId) setActiveCar(null);
      router.push("/auta");
      router.refresh();
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Nie udało się usunąć auta.");
      setDeleting(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-title">Działania</div>
      <div className="space-y-3 p-4 text-sm">
        <div>
          <button
            type="button"
            className="btn"
            onClick={saveOffline}
            disabled={offline?.running}
          >
            Zapisz do użytku offline
          </button>
          <p className="mt-1 text-xs text-steel">
            Pobiera wszystkie strony i ilustracje tego auta do pamięci
            przeglądarki.
          </p>
          {offline && (
            <div className="mt-2" aria-live="polite">
              <div className="h-1.5 w-full bg-line">
                <div
                  className="h-full bg-red"
                  style={{
                    width: `${offline.total ? (offline.done / offline.total) * 100 : 100}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-graphite">
                {offline.running
                  ? `Zapisywanie… ${offline.done} / ${offline.total}`
                  : `Zapisano ${offline.done - offline.failed} z ${offline.total} adresów${
                      offline.failed ? ` (błędy: ${offline.failed})` : ""
                    }.`}
              </p>
            </div>
          )}
        </div>
        {!builtIn && (
          <div className="border-t border-line pt-3">
            <button
              type="button"
              className="btn"
              onClick={remove}
              disabled={deleting}
            >
              {deleting ? "Usuwanie…" : "Usuń auto z bazy"}
            </button>
          </div>
        )}
        {error && <p className="text-red">{error}</p>}
      </div>
    </div>
  );
}
