"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDialog } from "@/components/Dialog";
import {
  forgetCarOffline,
  saveCarOffline,
  useOfflineState,
  useOnline,
} from "@/lib/offline";
import { setActiveCar, useAppData, useHydrated } from "@/lib/storage/hooks";

/** Offline copy status and the "delete car" action of the car page. */
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
  const hydrated = useHydrated();
  const online = useOnline();
  const offline = useOfflineState();
  const saved = hydrated ? offline.saved[carId] : undefined;
  const progress = offline.running[carId];
  const offlineError = offline.errors[carId];
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    const ok = await confirmDialog({
      title: "Usunąć auto?",
      message: (
        <>
          <p>
            Auto <strong>{label}</strong> i wszystkie jego instrukcje zostaną
            usunięte z aplikacji na wszystkich urządzeniach.
          </p>
          <p className="mt-2 text-graphite">
            Twoje notatki w Notatniku zostaną. Tej operacji nie można cofnąć.
          </p>
        </>
      ),
      confirmLabel: "Usuń auto",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${carId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Nie udało się usunąć auta.");
      }
      await forgetCarOffline(carId);
      if (settings.activeCar === carId) setActiveCar(null);
      router.push("/auta");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Brak połączenia z aplikacją. Spróbuj ponownie później."
          : err instanceof Error
            ? err.message
            : "Nie udało się usunąć auta.",
      );
      setDeleting(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-title">Bez internetu</div>
      <div className="space-y-3 p-4 text-sm">
        <div aria-live="polite">
          {progress ? (
            <>
              <p className="font-semibold">Zapisywanie do czytania offline…</p>
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
                % — możesz w tym czasie normalnie czytać.
              </p>
            </>
          ) : saved ? (
            <p>
              <span className="badge badge-dark mr-2">Gotowe</span>
              Instrukcje tego auta działają także bez internetu (zapisano{" "}
              {new Date(saved.savedAt).toLocaleDateString("pl-PL")}).
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
        </div>
        {!progress && (
          <button
            type="button"
            className="btn"
            disabled={!online}
            onClick={() => void saveCarOffline(carId, { force: true })}
          >
            {saved ? "Zapisz ponownie" : "Zapisz teraz"}
          </button>
        )}
        {!online && (
          <p className="text-xs text-steel">
            Jesteś offline — zapisane instrukcje działają, ale nie można ich
            teraz odświeżyć.
          </p>
        )}
        {!builtIn && (
          <div className="border-t border-line pt-3">
            <button
              type="button"
              className="btn"
              onClick={remove}
              disabled={deleting || !online}
            >
              {deleting ? "Usuwanie…" : "Usuń to auto"}
            </button>
          </div>
        )}
        {error && <p className="text-red">{error}</p>}
      </div>
    </div>
  );
}
