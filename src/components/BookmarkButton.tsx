"use client";

import {
  updateData,
  useAppData,
  useHydrated,
  withoutBookmark,
} from "@/lib/storage/hooks";

export function BookmarkButton({
  car,
  book,
  sectionId,
  title,
  href,
}: {
  car: string;
  book: string;
  sectionId: string;
  title: string;
  href: string;
}) {
  const data = useAppData();
  const hydrated = useHydrated();
  const id = `${car}:${book}:${sectionId}`;
  const active = hydrated && data.bookmarks.some((b) => b.id === id);

  const toggle = () =>
    updateData((d) =>
      d.bookmarks.some((b) => b.id === id)
        ? withoutBookmark(d, id)
        : {
            ...d,
            bookmarks: [
              ...d.bookmarks,
              {
                id,
                car,
                book,
                sectionId,
                title,
                href,
                createdAt: new Date().toISOString(),
              },
            ],
          },
    );

  return (
    <button
      type="button"
      className="btn"
      aria-pressed={active}
      onClick={toggle}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M3.5 1.5h9v13L8 11l-4.5 3.5Z"
          fill={active ? "#C8102E" : "none"}
          stroke={active ? "#C8102E" : "currentColor"}
          strokeWidth="1.4"
        />
      </svg>
      {/* Both labels share one grid cell: the button keeps the width of the
          longer one, so the page number beside it never moves. */}
      <span className="grid">
        {[true, false].map((label) => (
          <span
            key={String(label)}
            className={`[grid-area:1/1] ${label === active ? "" : "invisible"}`}
            aria-hidden={label !== active}
          >
            {label ? "W zakładkach" : "Dodaj zakładkę"}
          </span>
        ))}
      </span>
    </button>
  );
}
