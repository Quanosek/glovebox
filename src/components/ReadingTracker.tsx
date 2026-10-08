"use client";

import { useEffect } from "react";
import type { BookId } from "@/content/types";
import { updateData } from "@/lib/storage/hooks";

/** sessionStorage key set by "Kontynuuj czytanie" to restore the scroll position. */
export const RESTORE_SCROLL_KEY = "opel-cascada-manual:restore-scroll";

/** Remembers the last read section and scroll position. */
export function ReadingTracker({
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
  useEffect(() => {
    const save = () =>
      updateData((d) => ({
        ...d,
        lastRead: {
          book,
          sectionId,
          title,
          href,
          scrollY: Math.round(window.scrollY),
          at: new Date().toISOString(),
        },
      }));

    let restore: string | null = null;
    try {
      restore = sessionStorage.getItem(RESTORE_SCROLL_KEY);
      sessionStorage.removeItem(RESTORE_SCROLL_KEY);
    } catch {
      // sessionStorage unavailable
    }
    if (restore && !window.location.hash) {
      const y = Number(restore);
      if (Number.isFinite(y))
        requestAnimationFrame(() => window.scrollTo({ top: y }));
    }
    save();

    let timer: number | undefined;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(save, 800);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
    };
  }, [book, sectionId, title, href]);

  return null;
}
