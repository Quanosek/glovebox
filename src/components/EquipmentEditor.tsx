"use client";

import Link from "next/link";
import {
  FEATURE_GROUPS,
  FEATURES,
  suggestFromSpec,
  type FeatureGroupId,
  type FeatureState,
  type FeatureStatus,
} from "@/config/vehicle";
import type { CarSpec } from "@/lib/catalog";
import type { CarFeatureSections } from "@/lib/cars";
import {
  setFeatureState,
  setVehicleProfile,
  setCarEngine,
  useCarEngine,
  useHydrated,
  useVehicleProfile,
} from "@/lib/storage/hooks";
import { plural } from "@/lib/typography";
import { confirmDialog } from "./Dialog";
import { Skeleton } from "./Skeleton";
import { EngineSelector } from "./EngineSelector";

const MAX_LINKS = 5;

const CHOICES: { id: FeatureStatus | "unknown"; label: string }[] = [
  { id: "has", label: "Mam" },
  { id: "no", label: "Nie mam" },
  { id: "unknown", label: "Nie wiem" },
];

/**
 * Equipment checklist of one car: only the optional features described in
 * its manuals, each with "Mam" / "Nie mam" / "Nie wiem" and links to the
 * sections that describe it. Used on the car's equipment page and in the
 * last step of the "Dodaj auto" wizard.
 */
export function EquipmentEditor({
  carId,
  engines,
  catalog,
  year,
  sections,
}: {
  carId: string;
  engines: CarSpec[];
  catalog?: { brand: string; model: string };
  year?: number;
  sections: CarFeatureSections;
}) {
  const hydrated = useHydrated();
  const profile = useVehicleProfile(carId);
  const spec = useCarEngine(carId);
  const detected = FEATURES.filter((f) => sections[f.id]?.length);
  const suggestions = Object.entries(suggestFromSpec(spec ?? undefined)).filter(
    ([id]) => sections[id]?.length && !profile[id],
  );
  const groups = (Object.keys(FEATURE_GROUPS) as FeatureGroupId[]).filter((g) =>
    detected.some((f) => f.group === g),
  );

  if (!hydrated)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <EngineSelector
          carId={carId}
          engines={engines}
          catalog={catalog}
          year={year}
        />
        {groups.map((group) => (
          <section key={group} className="panel">
            <div className="panel-title">
              <Skeleton className="h-3 w-36" />
            </div>
            <ul className="divide-y divide-line">
              {detected
                .filter((feature) => feature.group === group)
                .map((feature) => (
                  <li
                    key={feature.id}
                    className="flex min-h-16 items-center gap-3 px-4 py-3"
                  >
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-8 w-40 shrink-0" />
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    );

  const marked = detected.filter((f) => profile[f.id]).length;
  const choose = (id: string, choice: FeatureStatus | "unknown") =>
    setFeatureState(
      carId,
      id,
      choice === "unknown" ? null : { status: choice, certainty: "confirmed" },
    );

  return (
    <div className="flex flex-col gap-4">
      <EngineSelector
        carId={carId}
        engines={engines}
        catalog={catalog}
        year={year}
      />
      {detected.length === 0 && (
        <p className="border-l-4 border-silver bg-paper px-4 py-3 text-sm text-graphite">
          W instrukcjach tego auta nie znaleziono opisów wyposażenia
          dodatkowego.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-graphite">
          Zaznaczono {marked} z {detected.length}{" "}
          {plural(detected.length, "pozycji", "pozycji", "pozycji")}.
        </p>
        <span className="flex flex-wrap gap-2">
          {suggestions.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() =>
                setVehicleProfile(carId, {
                  ...Object.fromEntries(suggestions),
                  ...profile,
                })
              }
            >
              Uzupełnij na podstawie silnika
            </button>
          )}
          {marked > 0 && (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Wyczyścić wyposażenie?",
                  message:
                    "Wybór silnika i wszystkie zaznaczenia wyposażenia tego auta zostaną usunięte. Instrukcja znów pokaże całą treść.",
                  confirmLabel: "Wyczyść",
                  danger: true,
                });
                if (ok) {
                  setCarEngine(carId, null);
                  setVehicleProfile(carId, {});
                }
              }}
            >
              Wyczyść wszystko
            </button>
          )}
        </span>
      </div>

      {groups.map((g) => (
        <section key={g} className="panel">
          <h2 className="panel-title">{FEATURE_GROUPS[g]}</h2>
          <ul className="divide-y divide-line text-sm">
            {detected
              .filter((f) => f.group === g)
              .map((f) => (
                <FeatureRow
                  key={f.id}
                  label={f.label}
                  note={"note" in f ? f.note : undefined}
                  state={profile[f.id]}
                  links={sections[f.id] ?? []}
                  onChoose={(choice) => choose(f.id, choice)}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FeatureRow({
  label,
  note,
  state,
  links,
  onChoose,
}: {
  label: string;
  note?: string;
  state: FeatureState | undefined;
  links: CarFeatureSections[string];
  onChoose: (choice: FeatureStatus | "unknown") => void;
}) {
  const current = state?.status ?? "unknown";
  const unsure = state && state.certainty !== "confirmed";
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <p className={state?.status === "no" ? "text-steel" : ""}>
          {label}
          {unsure && (
            <span className="badge ml-2 align-middle">
              {state.certainty === "probable"
                ? "podpowiedź – potwierdź"
                : "do weryfikacji"}
            </span>
          )}
        </p>
        {note && <p className="mt-1 text-xs text-graphite">{note}</p>}
        {links.length > 0 && (
          <p className="mt-1 text-xs text-steel">
            W instrukcji:{" "}
            {links.slice(0, MAX_LINKS).map((l, i) => (
              <span key={l.href}>
                {i > 0 && " · "}
                <Link
                  href={l.href}
                  className="text-graphite underline decoration-silver hover:text-red"
                >
                  {l.title}
                </Link>
              </span>
            ))}
            {links.length > MAX_LINKS && ` · +${links.length - MAX_LINKS}`}
          </p>
        )}
      </div>
      <div
        role="group"
        aria-label={label}
        className="flex shrink-0 gap-1 self-start"
      >
        {CHOICES.map((c) => {
          const pressed = current === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={pressed}
              className={`btn h-8 px-3 py-0 ${pressed ? (c.id === "has" ? "btn-primary" : c.id === "no" ? "btn-dark" : "btn-pressed") : ""}`}
              onClick={() => onChoose(c.id)}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </li>
  );
}
