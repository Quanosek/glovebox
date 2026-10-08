"use client";

import { useState, type ReactNode } from "react";
import { featureLabel, getAvailability } from "@/lib/availability";
import {
  updateData,
  useAppData,
  useHydrated,
  useVehicleProfile,
} from "@/lib/storage/hooks";

/**
 * Collapses sections (or, `compact`, parts of a section under a heading)
 * describing equipment the car does not have. The content stays in the DOM
 * (only `hidden`) so highlight anchoring and in-page links keep working.
 */
export function SectionGate({
  features,
  compact = false,
  children,
}: {
  features: string[];
  compact?: boolean;
  children: ReactNode;
}) {
  const profile = useVehicleProfile();
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState(false);

  const a = getAvailability(features, profile);
  const collapsed =
    hydrated && a.kind === "missing" && !settings.showUnavailable && !expanded;
  const greyed = hydrated && a.kind === "missing";

  if (compact)
    return (
      <>
        {collapsed && (
          <p
            className="my-3 flex flex-wrap items-center gap-2 border-l-4 border-silver bg-paper px-3 py-2 text-sm text-graphite print:hidden"
            data-anchor-ignore
          >
            <span className="flex-1">
              Ta część dotyczy wyposażenia, którego nie ma Twoje auto.
            </span>
            <button
              type="button"
              className="btn h-7 py-0"
              onClick={() => setExpanded(true)}
            >
              Pokaż
            </button>
          </p>
        )}
        <div
          hidden={collapsed}
          className={greyed ? "text-graphite opacity-75" : undefined}
        >
          {children}
        </div>
      </>
    );

  return (
    <>
      {collapsed && (
        <div className="panel my-4 print:hidden">
          <div className="panel-title">Brak w Twoim aucie</div>
          <div className="flex flex-col gap-3 p-4 text-sm text-graphite">
            <p>
              Ta część instrukcji dotyczy wyposażenia, którego według profilu
              nie ma w Twoim aucie:{" "}
              <strong className="text-ink">
                {a.missing.map(featureLabel).join(", ")}
              </strong>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => setExpanded(true)}
              >
                Pokaż tę część
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  updateData((d) => ({
                    ...d,
                    settings: { ...d.settings, showUnavailable: true },
                  }))
                }
              >
                Pokaż wszystko
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        hidden={collapsed}
        className={greyed ? "text-graphite opacity-75" : undefined}
      >
        {children}
      </div>
    </>
  );
}
