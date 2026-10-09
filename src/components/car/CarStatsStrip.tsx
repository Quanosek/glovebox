import Link from "next/link";
import type { CarStats } from "@/lib/overview";
import { plural } from "@/lib/typography";
import { OfflineStat } from "./OfflineStat";

const fmt = (n: number) => n.toLocaleString("pl-PL");

/** Row of large numbers under the car card (Navi 950 trip-computer style). */
export function CarStatsStrip({
  carId,
  stats,
}: {
  carId: string;
  stats: CarStats;
}) {
  const warningsHref = `/ostrzezenia?car=${carId}`;
  const danger = stats.warnings.danger + stats.warnings.warning;
  const cells = [
    stats.pages > 0 && {
      value: fmt(stats.pages),
      label: plural(stats.pages, "strona", "strony", "stron"),
    },
    {
      value: fmt(stats.sections),
      label: plural(stats.sections, "rozdział", "rozdziały", "rozdziałów"),
    },
    stats.illustrations > 0 && {
      value: fmt(stats.illustrations),
      label: plural(
        stats.illustrations,
        "ilustracja",
        "ilustracje",
        "ilustracji",
      ),
    },
    danger > 0 && {
      value: fmt(danger),
      label: plural(danger, "ostrzeżenie", "ostrzeżenia", "ostrzeżeń"),
      href: warningsHref,
      red: true,
    },
    stats.warnings.caution > 0 && {
      value: fmt(stats.warnings.caution),
      label: plural(
        stats.warnings.caution,
        "przestroga",
        "przestrogi",
        "przestróg",
      ),
      href: warningsHref,
    },
    stats.warnings.note > 0 && {
      value: fmt(stats.warnings.note),
      label: plural(stats.warnings.note, "uwaga", "uwagi", "uwag"),
      href: warningsHref,
    },
  ].filter(Boolean) as Array<{
    value: string;
    label: string;
    href?: string;
    red?: boolean;
  }>;

  return (
    <ul className="stat-strip" aria-label="Instrukcje w liczbach">
      {cells.map((c) => {
        const body = (
          <>
            <span className={`type-value block ${c.red ? "text-red" : ""}`}>
              {c.value}
            </span>
            <span className="mt-1.5 block text-xs text-graphite">
              {c.label}
            </span>
          </>
        );
        return (
          <li key={c.label}>
            {c.href ? (
              <Link href={c.href} className="stat-cell group hover:bg-paper">
                {body}
              </Link>
            ) : (
              <div className="stat-cell">{body}</div>
            )}
          </li>
        );
      })}
      <li>
        <OfflineStat carId={carId} />
      </li>
    </ul>
  );
}
