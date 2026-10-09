"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import type { GlossaryGroup } from "@/lib/overview";
import { plural } from "@/lib/typography";

const norm = (s: string) =>
  s.toLocaleLowerCase("pl").normalize("NFD").replace(/\p{M}/gu, "");

/** Symbol cards grouped by section, with a simple text filter. */
export function GlossaryGrid({ groups }: { groups: GlossaryGroup[] }) {
  const [query, setQuery] = useState("");
  const q = norm(useDeferredValue(query).trim());
  const shown = groups
    .map((g) => ({
      ...g,
      items: q
        ? g.items.filter((i) => norm(`${i.text} ${g.section}`).includes(q))
        : g.items,
    }))
    .filter((g) => g.items.length > 0);
  const total = shown.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="w-full max-w-md">
          <span className="sr-only">Szukaj symbolu po opisie</span>
          <input
            type="search"
            className="field"
            placeholder="Szukaj po opisie, np. „olej” albo „hamulec”"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <p className="text-sm text-graphite" aria-live="polite">
          {total} {plural(total, "symbol", "symbole", "symboli")}
        </p>
      </div>
      {shown.length === 0 && (
        <p className="mt-6 text-graphite">Nic nie pasuje do tego opisu.</p>
      )}
      <div className="mt-6 space-y-8">
        {shown.map((g) => (
          <section key={g.href}>
            <h2 className="section-label">
              <Link href={g.href} className="hover:text-red">
                {g.section}
              </Link>
              {g.book && (
                <span className="font-normal tracking-normal text-steel normal-case">
                  · {g.book}
                </span>
              )}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    className="panel hover-tile group flex h-full items-start gap-4 p-4"
                  >
                    <span className="thumb h-16 w-16 shrink-0 p-2">
                      <Image
                        src={i.src}
                        width={i.width}
                        height={i.height}
                        alt=""
                        loading="lazy"
                      />
                    </span>
                    <span className="min-w-0 text-base leading-snug group-hover:text-ink">
                      {i.text}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
