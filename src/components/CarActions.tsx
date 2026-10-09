"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDialog } from "@/components/Dialog";
import {
  saveCarOffline,
  useOfflineState,
  useOnline,
} from "@/lib/offline";
import {
  removeOwnedCar,
  useHydrated,
} from "@/lib/storage/hooks";

/** Offline copy status and the profile removal action of the car page. */
export function CarActions({ carId, label }: { carId: string; label: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const online = useOnline();
  const offline = useOfflineState();
  const saved = hydrated ? offline.saved[carId] : undefined;
  const progress = offline.running[carId];
  const offlineError = offline.errors[carId];
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    const ok = await confirmDialog({
      title: "Usunąć auto z Twoich aut?",
      message: (
        <>
          <p>
            <strong>{label}</strong> zniknie z Twojej listy aut. Instrukcje
            pozostaną dostępne i możesz dodać to auto ponownie.
          </p>
          <p className="mt-2 text-graphite">
            Twoje zaznaczenia, notatki i ustawienia nie zostaną usunięte.
          </p>
        </>
      ),
      confirmLabel: "Usuń z listy",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    removeOwnedCar(carId);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="panel">
      <div className="panel-title">Bez internetu</div>
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
            Nie ma internetu – zapisane instrukcje działają, ale nie można ich
            teraz odświeżyć.
          </p>
        )}
        <div className="border-t border-line pt-3">
          <button
            type="button"
            className="btn"
            onClick={remove}
            disabled={deleting}
          >
            {deleting ? "Usuwanie…" : "Usuń z moich aut"}
          </button>
        </div>
      </div>
    </div>
  );
}
