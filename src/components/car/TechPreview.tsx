import Link from "next/link";
import { techDataHref } from "@/lib/cars";
import type { TableFact } from "@/lib/overview";
import { plural } from "@/lib/typography";

/** Preview card of "Dane techniczne" with a few large values. */
export function TechPreview({
  carId,
  facts,
  tables,
}: {
  carId: string;
  facts: TableFact[];
  tables: number;
}) {
  if (tables === 0) return null;
  return (
    <section className="panel">
      <h2 className="panel-title">Dane techniczne</h2>
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-px bg-line">
          {facts.map((f) => (
            <div key={`${f.label}|${f.value}`} className="bg-white px-4 py-3">
              <dt className="truncate text-xs text-graphite" title={f.label}>
                {f.label}
              </dt>
              <dd className="type-value mt-1">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="border-t border-line px-4 py-3">
        <Link href={techDataHref(carId)} className="btn w-full justify-center">
          Wszystkie dane ({tables} {plural(tables, "tabela", "tabele", "tabel")}
          ) ›
        </Link>
      </div>
    </section>
  );
}
