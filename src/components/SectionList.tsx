"use client";

import Link from "next/link";
import { getAvailability } from "@/lib/availability";
import { useHydrated, useVehicleProfile } from "@/lib/storage/hooks";

export interface SectionListItem {
  id: string;
  title: string;
  href: string;
  page: number | null;
  features: string[];
}

/** List of (sub)sections with availability markers. */
export function SectionList({ items }: { items: SectionListItem[] }) {
  const profile = useVehicleProfile();
  const hydrated = useHydrated();
  if (items.length === 0) return null;

  return (
    <ul className="border-t border-line">
      {items.map((item) => {
        const kind = hydrated ? getAvailability(item.features, profile).kind : "neutral";
        const missing = kind === "missing";
        return (
          <li key={item.id} className="border-b border-line">
            <Link
              href={item.href}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-paper ${missing ? "text-steel" : ""}`}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span>{item.title}</span>
                {kind === "yours" && <span className="badge badge-dark">Twoje auto</span>}
                {kind === "verify" && <span className="badge">Do weryfikacji</span>}
                {kind === "probable" && <span className="badge">Prawdopodobnie</span>}
                {missing && <span className="badge badge-red">Brak w Twoim aucie</span>}
              </span>
              {item.page != null && <span className="shrink-0 text-xs text-steel">str. {item.page}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
