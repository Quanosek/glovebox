import Link from "next/link";
import type { CarStats } from "@/lib/overview";
import { plural } from "@/lib/typography";
import { WARNING_KINDS, warningKindLabel, warningsHref } from "@/lib/warnings";
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
  ].filter(Boolean) as Cell[];
  // Same categories and names as the filters of the warnings list.
  const warnings = WARNING_KINDS.filter((k) => stats.warnings[k.id] > 0).map(
    (kind): Cell => ({
      value: fmt(stats.warnings[kind.id]),
      label: warningKindLabel(kind.id, stats.warnings[kind.id]),
      href: warningsHref(carId, kind.id),
      red: kind.red,
    }),
  );

  // Two rows that each fill the width: the manuals, then their warnings.
  return (
    <div>
      <ul className="stat-strip" aria-label="Instrukcje w liczbach">
        {cells.map((c) => (
          <StatCell key={c.label} cell={c} />
        ))}
        <li>
          <OfflineStat carId={carId} />
        </li>
      </ul>
      {warnings.length > 0 && (
        <ul
          className="stat-strip border-t-0"
          aria-label="Ostrzeżenia w instrukcjach"
        >
          {warnings.map((c) => (
            <StatCell key={c.label} cell={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface Cell {
  value: string;
  label: string;
  href?: string;
  red?: boolean;
}

function StatCell({ cell: c }: { cell: Cell }) {
  const body = (
    <>
      <span className={`type-value block ${c.red ? "text-red" : ""}`}>
        {c.value}
      </span>
      <span className="mt-1.5 block text-xs text-graphite">{c.label}</span>
    </>
  );
  return (
    <li>
      {c.href ? (
        <Link href={c.href} className="stat-cell group hover:bg-paper">
          {body}
        </Link>
      ) : (
        <div className="stat-cell">{body}</div>
      )}
    </li>
  );
}
