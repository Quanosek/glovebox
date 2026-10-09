import Link from "next/link";
import type { QuickTile } from "@/lib/overview";
import { TopicIcon } from "./TopicIcon";

/** "Najczęściej potrzebne": only topics found in the car's manuals. */
export function QuickTiles({ tiles }: { tiles: QuickTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="section-label">
        Najczęściej potrzebne
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.id}>
            <Link
              href={t.href}
              className="nav-key hover-tile group"
              title={t.book ? `${t.section} · ${t.book}` : t.section}
            >
              <TopicIcon
                id={t.id}
                className="h-9 w-9 text-graphite transition-colors group-hover:text-red"
              />
              <span className="mt-3 block text-base leading-snug font-semibold">
                {t.label}
              </span>
              {t.section.toLocaleLowerCase("pl") !==
                t.label.toLocaleLowerCase("pl") && (
                <span className="mt-0.5 block truncate text-xs text-steel">
                  {t.section}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
