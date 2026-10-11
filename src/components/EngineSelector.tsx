"use client";

import { useEffect, useState } from "react";
import type { CarSpec } from "@/lib/catalog";
import { FUEL_LABEL } from "@/lib/catalog";
import { engineChoices, engineChoiceKey, sanitizeEngine } from "@/lib/engines";
import { setCarEngine, useCarEngine, useHydrated } from "@/lib/storage/hooks";

type CatalogOptions =
  | { key: string; state: "loading" }
  | { key: string; state: "done"; items: CarSpec[] }
  | { key: string; state: "error"; error: string };

export function EngineSelector({
  carId,
  engines,
  catalog,
  year,
}: {
  carId: string;
  engines: CarSpec[];
  catalog?: { brand: string; model: string };
  year?: number;
}) {
  const engine = useCarEngine(carId);
  const hydrated = useHydrated();
  const [options, setOptions] = useState<CatalogOptions | null>(null);
  const [attempt, setAttempt] = useState(0);
  const brand = catalog?.brand;
  const model = catalog?.model;
  const catalogKey = `${brand}:${model}:${year}`;
  useEffect(() => {
    if (engines.length || !brand || !model || !year) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- catalogue request starts
    setOptions({ key: catalogKey, state: "loading" });
    fetch(
      `/api/catalog/engines?${new URLSearchParams({ brand, model, year: String(year) })}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const body: { engines?: unknown[]; error?: string } = await r.json();
        if (!r.ok || !Array.isArray(body.engines))
          throw new Error(body.error ?? "Nie udało się wczytać silników.");
        const items = body.engines.map(sanitizeEngine);
        if (!items.every((e): e is CarSpec => e !== null))
          throw new Error(
            "Nie udało się odczytać listy silników. Spróbuj ponownie.",
          );
        return items;
      })
      .then((items) => {
        if (!controller.signal.aborted)
          setOptions({ key: catalogKey, state: "done", items });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setOptions({
            key: catalogKey,
            state: "error",
            error:
              err instanceof Error
                ? err.message
                : "Nie udało się wczytać silników.",
          });
      });
    return () => controller.abort();
  }, [engines.length, brand, model, year, attempt, catalogKey]);
  const result = options?.key === catalogKey ? options : null;
  const needsCatalog = engines.length === 0 && Boolean(brand && model && year);
  const loading = needsCatalog && (!result || result.state === "loading");
  const error = needsCatalog && result?.state === "error" ? result.error : null;
  const available = engines.length
    ? engines
    : result?.state === "done"
      ? result.items
      : [];
  const choices = engineChoices([...available, ...(engine ? [engine] : [])]);
  const fuels = [...new Set(choices.map((e) => e.fuel))];
  return (
    <section className="panel">
      <h2 className="panel-title">Silnik Twojego auta</h2>
      <div className="space-y-3 p-4 text-sm">
        <p className="text-graphite">
          Wybór dotyczy tylko Twojego profilu. Te same instrukcje mogą służyć
          autu z innym silnikiem. Pasujące dane i wyposażenie zostaną
          dostosowane do wyboru.
        </p>
        <label
          htmlFor={`engine-${carId}`}
          className="block text-xs font-semibold text-graphite"
        >
          Wersja silnika
        </label>
        {hydrated ? (
          <select
            id={`engine-${carId}`}
            className="field w-full"
            value={engine ? engineChoiceKey(engine) : ""}
            disabled={loading}
            aria-busy={loading}
            onChange={(e) =>
              setCarEngine(
                carId,
                choices.find(
                  (item) => engineChoiceKey(item) === e.target.value,
                ) ?? null,
              )
            }
          >
            {/* Loading is shown in the field itself, so the panel keeps its height. */}
            <option value="">
              {loading
                ? "Wczytuję silniki…"
                : "Nie wiem / pokaż wszystkie silniki"}
            </option>
            {fuels.map((fuel) => (
              <optgroup
                key={fuel}
                label={
                  FUEL_LABEL[fuel][0].toLocaleUpperCase("pl-PL") +
                  FUEL_LABEL[fuel].slice(1)
                }
              >
                {choices
                  .filter((e) => e.fuel === fuel)
                  .map((e) => (
                    <option key={engineChoiceKey(e)} value={engineChoiceKey(e)}>
                      {e.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <select
            className="field w-full"
            disabled
            aria-busy="true"
            aria-label="Wersja silnika"
          >
            <option>
              {engine
                ? engine.label
                : needsCatalog
                  ? "Wczytuję silniki…"
                  : "Nie wiem / pokaż wszystkie silniki"}
            </option>
          </select>
        )}
        {error && (
          <div role="alert" className="space-y-2 text-red">
            <p>{error}</p>
            <button
              type="button"
              className="btn"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Spróbuj ponownie
            </button>
          </div>
        )}
        {!loading && !error && choices.length === 0 && (
          <p className="text-graphite">
            Nie znaleziono listy silników dla tego auta. Instrukcje pozostają
            dostępne w całości.
          </p>
        )}
        <p className="text-xs text-steel">
          Wersje o tych samych parametrach są połączone. Jeśli instrukcja podaje
          dla nich różne wartości, pokazujemy je razem.
        </p>
      </div>
    </section>
  );
}
