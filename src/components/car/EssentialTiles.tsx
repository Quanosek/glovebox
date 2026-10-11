import Link from "next/link";
import type { EssentialTile } from "@/lib/overview";
import { polishTypography } from "@/lib/typography";
import { TopicIcon } from "./TopicIcon";

/**
 * Columns per tile count: rows are always full. 8 tiles show 4 on phones,
 * 6 on tablets and all 8 from `xl`; 6 tiles show 4, then 6; 4 tiles show 4.
 */
const GRID: Record<number, string> = {
  8: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 xl:grid-cols-4",
};

function visibility(count: number, index: number): string {
  if (count >= 8 && index >= 6) return "hidden xl:block";
  if (count >= 6 && index >= 4) return "hidden sm:block";
  return "";
}

/** "Niezbędnik": topics of the car's manuals, each opening its fragment. */
export function EssentialTiles({ tiles }: { tiles: EssentialTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <section aria-labelledby="essentials-title">
      <h2 id="essentials-title" className="section-label">
        Niezbędnik
      </h2>
      <ul
        className={`grid gap-3 ${GRID[tiles.length] ?? "grid-cols-2 xl:grid-cols-4"}`}
      >
        {tiles.map((t, i) => (
          <li key={t.href} className={visibility(tiles.length, i)}>
            <Link
              href={t.href}
              className="nav-key hover-tile group"
              title={t.book ? `${t.source} · ${t.book}` : t.source}
            >
              <TopicIcon
                id={t.id}
                className="h-9 w-9 text-graphite transition-colors group-hover:text-red"
              />
              <span className="mt-3 block text-base leading-snug font-semibold">
                {polishTypography(t.label)}
              </span>
              <span className="mt-1 line-clamp-2 block text-xs leading-snug text-graphite">
                {polishTypography(t.description, { lastWord: true })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
