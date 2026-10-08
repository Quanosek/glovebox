"use client";

import type { BookId } from "@/content/types";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";

export function BookmarkButton({
  book,
  sectionId,
  title,
  href,
}: {
  book: BookId;
  sectionId: string;
  title: string;
  href: string;
}) {
  const data = useAppData();
  const hydrated = useHydrated();
  const id = `${book}:${sectionId}`;
  const active = hydrated && data.bookmarks.some((b) => b.id === id);

  const toggle = () =>
    updateData((d) => ({
      ...d,
      bookmarks: d.bookmarks.some((b) => b.id === id)
        ? d.bookmarks.filter((b) => b.id !== id)
        : [...d.bookmarks, { id, book, sectionId, title, href, createdAt: new Date().toISOString() }],
    }));

  return (
    <button type="button" className="btn" aria-pressed={active} onClick={toggle}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M3.5 1.5h9v13L8 11l-4.5 3.5Z"
          fill={active ? "#C8102E" : "none"}
          stroke={active ? "#C8102E" : "currentColor"}
          strokeWidth="1.4"
        />
      </svg>
      {active ? "W zakładkach" : "Dodaj zakładkę"}
    </button>
  );
}
