"use client";

import {
  AVAILABILITY_LABEL,
  featureLabel,
  getAvailability,
} from "@/lib/availability";
import { useHydrated, useVehicleProfile } from "@/lib/storage/hooks";

/** Badges + notes describing whether a section applies to the owner's car. */
export function AvailabilityBadges({
  features,
  showNotes = true,
}: {
  features: string[];
  showNotes?: boolean;
}) {
  const profile = useVehicleProfile();
  const hydrated = useHydrated();
  if (!hydrated || features.length === 0) return null;
  const a = getAvailability(features, profile);
  if (a.kind === "neutral") return null;

  return (
    <div className="my-3 flex flex-col gap-2" data-anchor-ignore>
      <div className="flex flex-wrap items-center gap-1.5">
        {a.missing.length > 0 ? (
          <span
            className="badge badge-red"
            title={a.missing.map(featureLabel).join(", ")}
          >
            {AVAILABILITY_LABEL.missing}
          </span>
        ) : (
          <span
            className="badge badge-dark"
            title={a.present.map(featureLabel).join(", ")}
          >
            {AVAILABILITY_LABEL.yours}
          </span>
        )}
        {a.probable.length > 0 && (
          <span
            className="badge"
            title={a.probable.map(featureLabel).join(", ")}
          >
            {AVAILABILITY_LABEL.probable}
          </span>
        )}
        <span className="text-xs text-steel">
          {[...a.missing, ...a.present].map(featureLabel).join(" · ")}
        </span>
      </div>
      {showNotes &&
        a.notes.map((note) => (
          <p
            key={note}
            className="border-l-2 border-silver bg-paper px-3 py-1.5 text-sm text-graphite"
          >
            {note}
          </p>
        ))}
    </div>
  );
}
