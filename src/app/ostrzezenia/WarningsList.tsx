"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { WarningKind } from "@/content/types";
import { getAvailability } from "@/lib/availability";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import {
  WARNING_KINDS,
  warningKindFromSlug,
  warningsHref,
} from "@/lib/warnings";

export interface WarningItem {
  id: string;
  car: string;
  book: string;
  kind: WarningKind;
  title: string;
  section: string;
  href: string;
  page: number | null;
  text: string;
  features: string[];
}

export function WarningsList({
  carId,
  items: allItems,
}: {
  carId: string;
  items: WarningItem[];
}) {
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const { settings } = useAppData();
  const items = allItems;
  const count = (kind: WarningKind) =>
    items.filter((w) => w.kind === kind).length;
  // Only kinds this car's manuals contain, like the counts on the car page.
  const kinds = WARNING_KINDS.filter((k) => count(k.id) > 0);
  const requested = warningKindFromSlug(searchParams.get("rodzaj"));
  const kind: WarningKind | "all" =
    requested && count(requested) > 0 ? requested : "all";
  const choose = (next: WarningKind | "all") =>
    window.history.replaceState(
      null,
      "",
      warningsHref(carId, next === "all" ? undefined : next),
    );
  const filters: { id: WarningKind | "all"; label: string; count: number }[] = [
    { id: "all", label: "Wszystkie", count: items.length },
    ...kinds.map((k) => ({ id: k.id, label: k.label, count: count(k.id) })),
  ];

  const visible = items.filter((w) => {
    if (kind !== "all" && w.kind !== kind) return false;
    if (
      hydrated &&
      !settings.showUnavailable &&
      getAvailability(w.features, settings.vehicles[w.car] ?? {}).kind ===
        "missing"
    ) {
      return false;
    }
    return true;
  });
  const hiddenCount =
    items.filter((w) => kind === "all" || w.kind === kind).length -
    visible.length;

  return (
    <>
      <div
        className="mt-5 flex flex-wrap gap-1"
        role="group"
        aria-label="Rodzaj"
      >
        {filters.map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={kind === k.id}
            className={`btn ${kind === k.id ? "btn-primary" : ""}`}
            onClick={() => choose(k.id)}
          >
            {k.label} ({k.count})
          </button>
        ))}
      </div>
      {hiddenCount > 0 && (
        <p className="mt-3 text-xs text-steel">
          Ukryto {hiddenCount} pozycji dotyczących wyposażenia, którego nie ma
          Twoje auto (zmień w Ustawieniach: „Pokaż wszystko”).
        </p>
      )}
      {items.length === 0 && (
        <p className="mt-6 text-steel">
          Brak ostrzeżeń – treść instrukcji nie jest jeszcze gotowa.
        </p>
      )}
      <ul className="mt-4 flex flex-col gap-2">
        {visible.map((w) => (
          <li key={w.id}>
            <Link
              href={w.href}
              className={`block border-y border-r border-l-4 border-y-line border-r-line px-4 py-2 hover:bg-paper ${
                w.kind === "danger" || w.kind === "warning"
                  ? "border-l-red"
                  : "border-l-silver"
              }`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span
                  className={`font-bold tracking-[0.08em] uppercase ${
                    w.kind === "danger" || w.kind === "warning"
                      ? "text-red"
                      : "text-graphite"
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
