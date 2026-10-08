"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { equipmentHref, type CarSummary } from "@/lib/cars";
import type { FontSize } from "@/lib/storage/schema";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";
import { getStore } from "@/lib/storage/store";
import { confirmDialog } from "@/components/Dialog";
import { resetOfflineStatus } from "@/lib/offline";
import { plural } from "@/lib/typography";

const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: "small", label: "Mała" },
  { id: "normal", label: "Normalna" },
  { id: "large", label: "Duża" },
  { id: "xlarge", label: "Bardzo duża" },
];

export function SettingsView({ cars }: { cars: CarSummary[] }) {
  const data = useAppData();
  const hydrated = useHydrated();
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!hydrated) return <p className="mt-4 text-steel">Ładowanie…</p>;
  const { settings } = data;
  const store = getStore();

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
      const highlightCount = Object.keys(next.highlights).length;
      const pageCount = next.notebook.pages.length;
      const bookmarkCount = next.bookmarks.length;
      setMessage({
        kind: "ok",
        text: `Wczytano kopię: ${highlightCount} ${plural(highlightCount, "zaznaczenie", "zaznaczenia", "zaznaczeń")}, ${pageCount} ${plural(pageCount, "kartka", "kartki", "kartek")}, ${bookmarkCount} ${plural(bookmarkCount, "zakładka", "zakładki", "zakładek")}.`,
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
        "Zostaną usunięte wszystkie zaznaczenia, komentarze, notatki, zakładki i ustawienia z tej przeglądarki. Tej operacji nie można cofnąć – jeśli nie masz pewności, najpierw pobierz kopię zapasową.",
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
      text: "Instrukcje zapisane do czytania bez internetu zostały usunięte. Zapiszą się ponownie przy następnym otwarciu auta.",
    });
  };

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
          Nie udało się zapisać danych w tej przeglądarce. Zwolnij miejsce albo
          pobierz kopię zapasową.
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
              <strong>Pokaż wszystko</strong> – rozwijaj również sekcje o
              wyposażeniu, którego nie ma Twoje auto (oznaczone „Brak w Twoim
              aucie”).
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Wyposażenie aut</h2>
        <div className="p-4 text-sm">
          <p className="text-graphite">
            Dla każdego auta możesz zaznaczyć, które wyposażenie dodatkowe
            opisane w instrukcji ma Twój egzemplarz. Sekcje o brakującym
            wyposażeniu są wtedy zwijane i oznaczane jako „Brak w Twoim aucie”.
          </p>
          {cars.length === 0 ? (
            <p className="mt-3 text-steel">Nie dodano jeszcze żadnego auta.</p>
          ) : (
            <ul className="mt-3 border-t border-line">
              {cars.map((car) => {
                const count = Object.keys(
                  settings.vehicles[car.id] ?? {},
                ).length;
                return (
                  <li
                    key={car.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2"
                  >
                    <span>
                      <span className="font-semibold">{car.label}</span>
                      <span className="ml-2 text-xs text-steel">
                        {count > 0
                          ? `zaznaczono ${count} ${plural(count, "element", "elementy", "elementów")}`
                          : "nic nie zaznaczono"}
                      </span>
                    </span>
                    <Link href={equipmentHref(car.id)} className="btn">
                      Wyposażenie
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Kopie zapasowe i dane</h2>
        <div className="flex flex-col gap-4 p-4 text-sm">
          <p className="text-graphite">
            Twoje zaznaczenia, komentarze, notatki i zakładki są zapisane tylko
            w tej przeglądarce. Wyczyszczenie historii przeglądarki usunie je
            bezpowrotnie – co jakiś czas pobierz kopię zapasową do pliku.
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
              <option value="merge">Dołącz do obecnych danych</option>
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
              Usuń instrukcje zapisane bez internetu
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
