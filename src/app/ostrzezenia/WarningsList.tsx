"use client";

import Link from "next/link";
import { useState } from "react";
import type { WarningKind } from "@/content/types";
import { getAvailability } from "@/lib/availability";
import { useAppData, useHydrated, useVehicleProfile } from "@/lib/storage/hooks";

export interface WarningItem {
  id: string;
  book: string;
  kind: WarningKind;
  title: string;
  section: string;
  href: string;
  page: number | null;
  text: string;
  features: string[];
}

const KINDS: { id: WarningKind | "all"; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "danger", label: "Niebezpieczeństwo" },
  { id: "warning", label: "Ostrzeżenie" },
  { id: "caution", label: "Przestroga" },
  { id: "note", label: "Uwaga" },
];

export function WarningsList({ items }: { items: WarningItem[] }) {
  const [kind, setKind] = useState<WarningKind | "all">("all");
  const profile = useVehicleProfile();
  const hydrated = useHydrated();
  const { settings } = useAppData();

  const visible = items.filter((w) => {
    if (kind !== "all" && w.kind !== kind) return false;
    if (hydrated && !settings.showUnavailable && getAvailability(w.features, profile).kind === "missing") {
      return false;
    }
    return true;
  });
  const hiddenCount = items.filter((w) => kind === "all" || w.kind === kind).length - visible.length;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="Rodzaj">
        {KINDS.map((k) => {
          const count = k.id === "all" ? items.length : items.filter((w) => w.kind === k.id).length;
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              className={`btn ${kind === k.id ? "btn-primary" : ""}`}
              onClick={() => setKind(k.id)}
            >
              {k.label} ({count})
            </button>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <p className="mt-3 text-xs text-steel">
          Ukryto {hiddenCount} pozycji dotyczących wyposażenia, którego nie ma Twoje auto (zmień w
          Ustawieniach: „Pokaż wszystko”).
        </p>
      )}
      {items.length === 0 && (
        <p className="mt-6 text-steel">Brak ostrzeżeń — treść instrukcji nie została jeszcze wygenerowana.</p>
      )}
      <ul className="mt-4 flex flex-col gap-2">
        {visible.map((w) => (
          <li key={w.id}>
            <Link
              href={w.href}
              className={`block border-y border-r border-l-4 border-y-line border-r-line px-4 py-2 hover:bg-paper ${
                w.kind === "danger" || w.kind === "warning" ? "border-l-red" : "border-l-silver"
              }`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span
                  className={`font-bold tracking-[0.08em] uppercase ${
                    w.kind === "danger" || w.kind === "warning" ? "text-red" : "text-graphite"
                  }`}
                >
                  {w.title}
                </span>
                <span className="text-steel">
                  {w.book} › {w.section}
                  {w.page != null ? ` · str. ${w.page}` : ""}
                </span>
              </span>
              <span className="mt-1 line-clamp-3 block text-sm">{w.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
