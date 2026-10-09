"use client";

import Link from "next/link";
import { carName, type CarSummary } from "@/lib/cars";
import { shorten } from "@/lib/overview";
import { useAppData, useHydrated } from "@/lib/storage/hooks";
import { Skeleton } from "../Skeleton";

const LIMIT = 5;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  });

/** Recently read sections and recent highlights/comments of the profile. */
export function RecentActivity({ cars }: { cars: CarSummary[] }) {
  const hydrated = useHydrated();
  const { history, highlights, lastRead } = useAppData();
  if (!hydrated)
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="panel space-y-3 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ))}
      </div>
    );

  // The newest entry is already shown by "Czytaj dalej".
  const read = history
    .filter((h) => h.href !== lastRead?.href)
    .slice(0, LIMIT);
  const marks = Object.values(highlights)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, LIMIT);
  if (read.length === 0 && marks.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {read.length > 0 && (
        <section className="panel" aria-labelledby="recent-read-title">
          <h2 id="recent-read-title" className="panel-title">
            Ostatnio czytane
          </h2>
          <ul className="divide-y divide-line">
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
                      <span aria-hidden="true" className="h-0.5 w-5 bg-silver" />
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
      {marks.length > 0 && (
        <section className="panel" aria-labelledby="recent-marks-title">
          <h2 id="recent-marks-title" className="panel-title">
            Ostatnie zaznaczenia i komentarze
          </h2>
          <ul className="divide-y divide-line">
            {marks.map((h) => (
              <li key={h.id}>
                <Link
                  href={`${h.href}#hl-${h.id}`}
                  className="hover-row group block px-4 py-2.5"
                >
                  <span className="block text-sm group-hover:text-red">
                    „{shorten(h.anchor.exact, 110)}”
                  </span>
                  {h.comment.trim() && (
                    <span className="mt-0.5 block border-l-2 border-red pl-2 text-sm text-graphite">
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
    </div>
  );
}
