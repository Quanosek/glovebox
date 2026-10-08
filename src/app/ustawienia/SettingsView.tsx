"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_PROFILE,
  FEATURE_GROUPS,
  FEATURES,
  type FeatureCertainty,
  type FeatureGroupId,
  type FeatureState,
  type FeatureStatus,
} from "@/config/vehicle";
import type { FontSize } from "@/lib/storage/schema";
import {
  updateData,
  useAppData,
  useHydrated,
  useVehicleProfile,
} from "@/lib/storage/hooks";
import { getStore } from "@/lib/storage/store";
import { confirmDialog } from "@/components/Dialog";
import { resetOfflineStatus } from "@/lib/offline";

const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: "small", label: "Mała" },
  { id: "normal", label: "Normalna" },
  { id: "large", label: "Duża" },
  { id: "xlarge", label: "Bardzo duża" },
];

const CERTAINTY: { id: FeatureCertainty; label: string }[] = [
  { id: "confirmed", label: "potwierdzone" },
  { id: "verify", label: "do weryfikacji" },
  { id: "probable", label: "prawdopodobnie" },
];

export function SettingsView() {
  const data = useAppData();
  const hydrated = useHydrated();
  const profile = useVehicleProfile();
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!hydrated) return <p className="mt-4 text-steel">Ładowanie…</p>;
  const { settings } = data;
  const store = getStore();

  const setFeature = (id: string, state: FeatureState) =>
    updateData((d) => {
      const vehicle = { ...d.settings.vehicle };
      const def = DEFAULT_PROFILE[id];
      if (
        def &&
        def.status === state.status &&
        def.certainty === state.certainty
      )
        delete vehicle[id];
      else vehicle[id] = state;
      return { ...d, settings: { ...d.settings, vehicle } };
    });

  const exportData = () => {
    const blob = new Blob([store.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opel-cascada-notatki-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ kind: "ok", text: "Kopia zapasowa została pobrana." });
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      if (
        importMode === "replace" &&
        !(await confirmDialog({
          title: "Zastąpić obecne dane?",
          message:
            "Wszystkie obecne zaznaczenia, komentarze, notatki i zakładki zostaną zastąpione zawartością kopii zapasowej.",
          confirmLabel: "Zastąp",
          danger: true,
        }))
      )
        return;
      const next = store.importJson(text, importMode);
      setMessage({
        kind: "ok",
        text: `Wczytano kopię: ${Object.keys(next.highlights).length} zaznaczeń, ${next.notebook.pages.length} kartek, ${next.bookmarks.length} zakładek.`,
      });
    } catch (err) {
      setMessage({
        kind: "error",
        text: `Nie udało się wczytać kopii: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearAll = async () => {
    const ok = await confirmDialog({
      title: "Usunąć wszystkie dane?",
      message:
        "Zostaną usunięte wszystkie zaznaczenia, komentarze, notatki, zakładki i ustawienia z tej przeglądarki. Tej operacji nie można cofnąć — jeśli nie masz pewności, najpierw pobierz kopię zapasową.",
      confirmLabel: "Usuń wszystko",
      danger: true,
    });
    if (!ok) return;
    store.clear();
    setMessage({ kind: "ok", text: "Wszystkie dane zostały usunięte." });
  };

  const clearOffline = async () => {
    if (!("caches" in window)) return;
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("opel-cascada-manual"))
        .map((k) => caches.delete(k)),
    );
    resetOfflineStatus();
    setMessage({
      kind: "ok",
      text: "Instrukcje zapisane do czytania offline zostały usunięte. Zapiszą się ponownie przy następnym otwarciu auta.",
    });
  };

  const groups = Object.keys(FEATURE_GROUPS) as FeatureGroupId[];

  return (
    <div className="mt-4 flex flex-col gap-6">
      {message && (
        <p
          role="status"
          className={`border-l-4 bg-paper px-4 py-2 text-sm ${message.kind === "error" ? "border-red text-red" : "border-graphite"}`}
        >
          {message.text}
        </p>
      )}
      {store.lastError && (
        <p className="border-l-4 border-red bg-paper px-4 py-2 text-sm text-red">
          Nie udało się zapisać danych w przeglądarce: {store.lastError}
        </p>
      )}

      <section className="panel">
        <h2 className="panel-title">Wygląd i treść</h2>
        <div className="flex flex-col gap-4 p-4 text-sm">
          <fieldset>
            <legend className="mb-2 font-semibold">
              Wielkość czcionki instrukcji
            </legend>
            <div className="flex flex-wrap gap-1">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={settings.fontSize === f.id}
                  className={`btn ${settings.fontSize === f.id ? "btn-primary" : ""}`}
                  onClick={() =>
                    updateData((d) => ({
                      ...d,
                      settings: { ...d.settings, fontSize: f.id },
                    }))
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 accent-red"
              checked={settings.showUnavailable}
              onChange={(e) =>
                updateData((d) => ({
                  ...d,
                  settings: {
                    ...d.settings,
                    showUnavailable: e.target.checked,
                  },
                }))
              }
            />
            <span>
              <strong>Pokaż wszystko</strong> — rozwijaj również sekcje o
              wyposażeniu, którego nie ma Twoje auto (oznaczone „Brak w Twoim
              aucie”).
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title flex items-center justify-between">
          Wyposażenie: Opel Cascada MY16
          <button
            type="button"
            className="btn h-7 py-0 normal-case"
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Przywrócić domyślne wyposażenie?",
                message:
                  "Wszystkie Twoje zmiany w liście wyposażenia zostaną cofnięte.",
                confirmLabel: "Przywróć",
              });
              if (ok)
                updateData((d) => ({
                  ...d,
                  settings: { ...d.settings, vehicle: {} },
                }));
            }}
          >
            Przywróć domyślne
          </button>
        </h2>
        <div className="p-4 text-sm">
          <p className="mb-3 text-graphite">
            Określ, które wyposażenie ma Twoja Cascada. Sekcje instrukcji
            dotyczące brakującego wyposażenia są zwijane i oznaczane jako „Brak
            w Twoim aucie”. Profil wyposażenia dotyczy tylko wbudowanego auta
            Opel Cascada 2016 — auta dodane w kreatorze pokazują pełną treść.
          </p>
          {groups.map((g) => (
            <fieldset key={g} className="mb-4">
              <legend className="mb-1 text-xs font-semibold tracking-[0.08em] text-graphite uppercase">
                {FEATURE_GROUPS[g]}
              </legend>
              <ul className="border-t border-line">
                {FEATURES.filter((f) => f.group === g).map((f) => {
                  const state = profile[f.id];
                  const changed = f.id in settings.vehicle;
                  return (
                    <li
                      key={f.id}
                      className="flex flex-col gap-2 border-b border-line py-2 sm:flex-row sm:items-center"
                    >
                      <span className="flex-1">
                        {f.label}
                        {changed && (
                          <span className="ml-2 text-xs text-red">
                            (zmienione)
                          </span>
                        )}
                      </span>
                      <span className="flex gap-1">
                        <select
                          className="field w-32 py-1"
                          value={state.status}
                          aria-label={`${f.label} — status`}
                          onChange={(e) =>
                            setFeature(f.id, {
                              ...state,
                              status: e.target.value as FeatureStatus,
                            })
                          }
                        >
                          <option value="has">Mam</option>
                          <option value="no">Nie mam</option>
                        </select>
                        <select
                          className="field w-40 py-1"
                          value={state.certainty}
                          aria-label={`${f.label} — pewność`}
                          onChange={(e) =>
                            setFeature(f.id, {
                              ...state,
                              certainty: e.target.value as FeatureCertainty,
                            })
                          }
                        >
                          {CERTAINTY.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Kopia zapasowa i dane</h2>
        <div className="flex flex-col gap-4 p-4 text-sm">
          <p className="text-graphite">
            Twoje zaznaczenia, komentarze, notatki i zakładki są zapisane tylko
            w tej przeglądarce. Wyczyszczenie historii przeglądarki usunie je
            bezpowrotnie — co jakiś czas pobierz kopię zapasową do pliku.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={exportData}
            >
              Pobierz kopię zapasową
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="field w-auto py-1"
              value={importMode}
              onChange={(e) =>
                setImportMode(e.target.value as "merge" | "replace")
              }
              aria-label="Sposób wczytania kopii"
            >
              <option value="merge">Scal z obecnymi danymi</option>
              <option value="replace">Zastąp obecne dane</option>
            </select>
            <label className="btn">
              Wczytaj kopię z pliku…
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importData(file);
                }}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button
              type="button"
              className="btn"
              onClick={() => void clearOffline()}
            >
              Usuń instrukcje zapisane offline
            </button>
            <button
              type="button"
              className="btn text-red"
              onClick={() => void clearAll()}
            >
              Usuń wszystkie dane
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
