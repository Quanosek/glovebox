"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { carName, type CarSummary } from "@/lib/cars";
import { shorten } from "@/lib/overview";
import { PROFILE_LIST_LIMIT } from "@/lib/storage/hint";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { Skeleton } from "../Skeleton";

const LIMIT = PROFILE_LIST_LIMIT;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  });

/**
 * Recently read sections and recent highlights/comments of the profile. When
 * only one of the two lists has entries, `filler` takes the free half of the
 * row; without a filler the single list spans the whole row.
 */
export function RecentActivity({
  cars,
  filler,
}: {
  cars: CarSummary[];
  filler?: ReactNode;
}) {
  const hydrated = useHydrated();
  const { history, highlights, lastRead } = useAppData();
  const hint = useLayoutHint();

  // The newest entry is already shown by "Czytaj dalej".
  const read = history.filter((h) => h.href !== lastRead?.href).slice(0, LIMIT);
  const marks = Object.values(highlights)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, LIMIT);
  // Before hydration: placeholder rows of the same size, counted by the hint.
  const readRows = hydrated ? read.length : hint.read;
  const markRows = hydrated ? marks.length : hint.marks.length;
  if (readRows === 0 && markRows === 0) return null;
  const single = readRows === 0 || markRows === 0;
  const span = single && !filler ? "md:col-span-2" : "";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {readRows > 0 && (
        <section
          className={`panel ${span}`}
          aria-labelledby="recent-read-title"
        >
          <h2 id="recent-read-title" className="panel-title">
            Ostatnio czytane
          </h2>
          <ul
            className="divide-y divide-line"
            aria-busy={hydrated ? undefined : true}
          >
            {!hydrated &&
              Array.from({ length: hint.read }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="thumb h-11 w-14 shrink-0 p-0.5" />
                  <span className="min-w-0 flex-1">
                    <Skeleton className="w-3/4" />
                    <Skeleton className="w-1/3 text-xs" />
                  </span>
                </li>
              ))}
            {read.map((h) => (
              <li key={h.href}>
                <Link
                  href={h.href}
                  className="hover-row group flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="thumb h-11 w-14 shrink-0 p-0.5">
                    {h.thumb ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- local manual illustration */
                      <img src={h.thumb} alt="" loading="lazy" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="h-0.5 w-5 bg-silver"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold group-hover:text-red">
                      {h.title}
                    </span>
                    <span className="block truncate text-xs text-steel">
                      {carName(cars, h.car)} · {when(h.at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {markRows > 0 && (
        <section
          className={`panel ${span}`}
          aria-labelledby="recent-marks-title"
        >
          <h2 id="recent-marks-title" className="panel-title">
            Ostatnie zaznaczenia i komentarze
          </h2>
          <ul
            className="divide-y divide-line"
            aria-busy={hydrated ? undefined : true}
          >
            {!hydrated &&
              hint.marks.map((withComment, i) => (
                <li key={i} className="px-4 py-2.5">
                  <Skeleton className="w-5/6 text-sm" />
                  {withComment && (
                    <span className="mt-0.5 block border-l-2 border-line pl-2">
                      <Skeleton className="w-2/3 text-sm" />
                    </span>
                  )}
                  <Skeleton className="mt-0.5 w-1/2 text-xs" />
                </li>
              ))}
            {marks.map((h) => (
              <li key={h.id}>
                <Link
                  href={`${h.href}#hl-${h.id}`}
                  className="hover-row group block px-4 py-2.5"
                >
                  <span className="block truncate text-sm group-hover:text-red">
                    „{shorten(h.anchor.exact, 110)}”
                  </span>
                  {h.comment.trim() && (
                    <span className="mt-0.5 block truncate border-l-2 border-red pl-2 text-sm text-graphite">
                      {shorten(h.comment, 110)}
                    </span>
                  )}
                  <span className="mt-0.5 block truncate text-xs text-steel">
                    {h.sectionTitle} · {when(h.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-2 text-right text-sm">
            <Link href="/komentarze" className="text-red hover:underline">
              Wszystkie zaznaczenia ›
            </Link>
          </div>
        </section>
      )}
      {single && filler}
    </div>
  );
}
