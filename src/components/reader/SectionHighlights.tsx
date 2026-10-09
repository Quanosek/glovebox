"use client";

import { HIGHLIGHT_COLORS } from "@/lib/highlightColors";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { shorten } from "@/lib/overview";

/** "Moje zaznaczenia" of the open section (reader side column). */
export function SectionHighlights({
  car,
  book,
  sectionId,
}: {
  car: string;
  book: string;
  sectionId: string;
}) {
  const hydrated = useHydrated();
  const { highlights } = useAppData();
  if (!hydrated) return null;
  const own = Object.values(highlights)
    .filter((h) => h.car === car && h.book === book && h.sectionId === sectionId)
    .sort((a, b) => a.anchor.start - b.anchor.start);
  if (own.length === 0) return null;
  return (
    <div>
      <h2 className="section-label mb-2">Moje zaznaczenia</h2>
      <ul className="space-y-2 text-sm">
        {own.map((h) => (
          <li key={h.id}>
            <a
              href={`#hl-${h.id}`}
              className="block border-l-4 py-0.5 pl-2 hover:text-red"
              style={{
                borderColor: HIGHLIGHT_COLORS.find((c) => c.id === h.color)
                  ?.swatch,
              }}
            >
              {shorten(h.anchor.exact, 90)}
              {h.comment && (
                <span className="mt-0.5 block text-xs text-graphite">
                  {shorten(h.comment, 80)}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
