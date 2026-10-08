"use client";

import Link from "next/link";
import { confirmDialog } from "@/components/Dialog";
import { bookName, carName, type CarSummary } from "@/lib/cars";
import { useState } from "react";
import { HIGHLIGHT_COLORS } from "@/lib/highlightColors";
import type { Highlight } from "@/lib/storage/schema";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";

export function CommentsView({ cars }: { cars: CarSummary[] }) {
  const data = useAppData();
  const hydrated = useHydrated();
  const [onlyComments, setOnlyComments] = useState(false);

  if (!hydrated) return <p className="mt-4 text-steel">Ładowanie…</p>;

  const all = Object.values(data.highlights);
  const list = all
    .filter((h) => !onlyComments || h.comment.trim())
    .sort(
      (a, b) =>
        a.car.localeCompare(b.car) ||
        a.book.localeCompare(b.book) ||
        a.href.localeCompare(b.href) ||
        a.anchor.start - b.anchor.start,
    );

  const groups = new Map<string, Highlight[]>();
  for (const h of list) {
    const key = `${h.car}:${h.book}:${h.sectionId}`;
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }

  const remove = (id: string) =>
    updateData((d) => {
      const next = { ...d.highlights };
      delete next[id];
      return { ...d, highlights: next };
    });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-graphite">
          Zaznaczeń: <strong>{all.length}</strong>, z komentarzem:{" "}
          <strong>{all.filter((h) => h.comment.trim()).length}</strong>
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-red"
            checked={onlyComments}
            onChange={(e) => setOnlyComments(e.target.checked)}
          />
          Tylko z komentarzem
        </label>
      </div>

      {list.length === 0 && (
        <p className="mt-6 text-steel">
          Brak zaznaczeń. Zaznacz fragment tekstu w instrukcji, aby wyróżnić go
          kolorem i dodać komentarz.
        </p>
      )}

      {[...groups.entries()].map(([key, items]) => (
        <section key={key} className="panel mt-4">
          <h2 className="panel-title flex flex-wrap justify-between gap-2 normal-case">
            <Link href={items[0].href} className="text-ink hover:text-red">
              {items[0].sectionTitle}
            </Link>
            <span className="font-normal">
              {carName(cars, items[0].car)} ·{" "}
              {bookName(cars, items[0].car, items[0].book)}
            </span>
          </h2>
          <ul className="divide-y divide-line">
            {items.map((h) => (
              <li key={h.id} className="flex gap-3 p-3 text-sm">
                <span
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 border border-steel"
                  style={{
                    background: HIGHLIGHT_COLORS.find((c) => c.id === h.color)
                      ?.swatch,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <q className="block">
                    {h.anchor.exact.length > 240
                      ? `${h.anchor.exact.slice(0, 239)}…`
                      : h.anchor.exact}
                  </q>
                  {h.comment.trim() && (
                    <p className="mt-1 whitespace-pre-wrap text-graphite">
                      {h.comment}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-steel">
                    {new Date(h.updatedAt).toLocaleString("pl-PL")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                  <Link href={`${h.href}#hl-${h.id}`} className="btn h-7 py-0">
                    Przejdź
                  </Link>
                  <button
                    type="button"
                    className="btn h-7 py-0"
                    onClick={async () => {
                      if (
                        await confirmDialog({
                          title: "Usunąć zaznaczenie?",
                          message:
                            "Zaznaczenie zostanie usunięte razem z komentarzem.",
                          confirmLabel: "Usuń",
                          danger: true,
                        })
                      )
                        remove(h.id);
                    }}
                  >
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
