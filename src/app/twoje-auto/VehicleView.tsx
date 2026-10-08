"use client";

import Link from "next/link";
import { FEATURE_GROUPS, FEATURES, type FeatureGroupId } from "@/config/vehicle";
import type { FeatureSectionLink } from "@/lib/content";
import { useHydrated, useVehicleProfile } from "@/lib/storage/hooks";

const CERTAINTY_LABEL = { confirmed: "", verify: "do weryfikacji", probable: "prawdopodobnie" } as const;

export function VehicleView({ featureSections }: { featureSections: Record<string, FeatureSectionLink[]> }) {
  const profile = useVehicleProfile();
  const hydrated = useHydrated();
  const groups = Object.keys(FEATURE_GROUPS) as FeatureGroupId[];
  const toVerify = FEATURES.filter((f) => profile[f.id].certainty !== "confirmed");

  return (
    <>
      {hydrated && toVerify.length > 0 && (
        <section className="panel mt-6">
          <h2 className="panel-title">Do weryfikacji ({toVerify.length})</h2>
          <ul className="divide-y divide-line text-sm">
            {toVerify.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>{f.label}</span>
                <span className="badge">
                  {profile[f.id].status === "has" ? "mam" : "nie mam"} · {CERTAINTY_LABEL[profile[f.id].certainty]}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-steel">
            Zmień status w Ustawieniach → Profil pojazdu.
          </p>
        </section>
      )}

      {groups.map((g) => (
        <section key={g} className="panel mt-6">
          <h2 className="panel-title">{FEATURE_GROUPS[g]}</h2>
          <ul className="divide-y divide-line text-sm">
            {FEATURES.filter((f) => f.group === g).map((f) => {
              const state = profile[f.id];
              const has = state.status === "has";
              const links = featureSections[f.id] ?? [];
              return (
                <li key={f.id} className={`px-4 py-2 ${has ? "" : "text-steel"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`inline-block h-2.5 w-2.5 border ${has ? "border-red bg-red" : "border-silver bg-white"}`}
                      />
                      {f.label}
                    </span>
                    {hydrated && (
                      <span className="flex gap-1">
                        <span className={`badge ${has ? "badge-dark" : "badge-red"}`}>
                          {has ? "Twoje auto" : "Brak w Twoim aucie"}
                        </span>
                        {state.certainty !== "confirmed" && (
                          <span className="badge">{CERTAINTY_LABEL[state.certainty]}</span>
                        )}
                      </span>
                    )}
                  </div>
                  {"note" in f && f.note && <p className="mt-1 text-xs text-graphite">{f.note}</p>}
                  {links.length > 0 && (
                    <p className="mt-1 text-xs">
                      {links.slice(0, 8).map((l, i) => (
                        <span key={l.href}>
                          {i > 0 && " · "}
                          <Link href={l.href} className="text-graphite underline decoration-silver hover:text-red">
                            {l.title}
                          </Link>
                        </span>
                      ))}
                      {links.length > 8 && <span className="text-steel"> · +{links.length - 8}</span>}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
