"use client";

import Link from "next/link";
import { equipmentHref, techDataHref } from "@/lib/cars";
import type { TechCard } from "@/lib/overview";
import type { CarSpec } from "@/lib/catalog";
import { driverFacts } from "@/lib/driverFacts";
import { useCarEngine } from "@/lib/storage/hooks";
import { plural } from "@/lib/typography";

/** Preview card of "Dane techniczne" with a few large values. */
export function TechPreview({
  carId,
  cards,
  engines,
  tables,
}: {
  carId: string;
  cards: TechCard[];
  engines: CarSpec[];
  tables: number;
}) {
  const engine = useCarEngine(carId);
  const facts = driverFacts(cards, engine, engines);
  if (tables === 0 && !engine) return null;
  return (
    <section className="panel">
      <h2 className="panel-title">Dane techniczne</h2>
      {facts.length > 0 && (
        <dl
          className={`grid gap-px bg-line ${facts.length === 3 ? "grid-cols-3" : facts.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {facts.map((f) => (
            <div key={f.label} className="min-w-0 bg-white px-4 py-3">
              <dt className="text-xs text-graphite">{f.label}</dt>
              <dd className="type-item mt-1">
                {f.href ? (
                  <Link href={f.href} className="hover:underline">
                    {f.value}
                  </Link>
                ) : (
                  f.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!engine && (
        <p className="px-4 py-3 text-sm text-graphite">
          <Link
            href={equipmentHref(carId)}
            className="text-red hover:underline"
          >
            Wybierz silnik w wyposażeniu
          </Link>
          , aby dopasować dane do Twojego auta.
        </p>
      )}
      {facts.length === 0 && (
        <p className="px-4 pb-3 text-sm text-graphite">
          Instrukcja nie podaje podstawowych danych w jednoznacznej tabeli.
          Pełne dane znajdziesz poniżej.
        </p>
      )}
      {tables > 0 && (
        <div className="border-t border-line px-4 py-3">
          <Link
            href={techDataHref(carId)}
            className="btn w-full justify-center"
          >
            Wszystkie dane ({tables}{" "}
            {plural(tables, "tabela", "tabele", "tabel")}) ›
          </Link>
        </div>
      )}
    </section>
  );
}
