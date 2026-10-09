import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carHref, carLabel } from "@/lib/cars";
import { getTechCards } from "@/lib/carOverview";
import { getCar } from "@/lib/content";
import { isNumeric } from "@/lib/overview";

type Props = PageProps<"/auto/[car]/dane-techniczne">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const car = getCar((await params).car);
  return {
    title: car ? `Dane techniczne – ${carLabel(car)}` : "Nie znaleziono",
  };
}

/** Tables from the technical-data chapters as readable cards. */
export default async function TechDataPage({ params }: Props) {
  const car = getCar((await params).car);
  if (!car) notFound();
  const cards = getTechCards(car);

  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Dane techniczne</h1>
      <p className="mt-3 max-w-3xl text-graphite">
        Pojemności, ciśnienia, wymiary i inne wartości z instrukcji{" "}
        <Link href={carHref(car.id)} className="text-red hover:underline">
          {carLabel(car)}
        </Link>
        . Przy każdej tabeli jest odnośnik do miejsca w instrukcji – tam
        znajdziesz pełny opis i przypisy.
      </p>
      {cards.length === 0 && (
        <p className="panel mt-6 p-4 text-graphite">
          W instrukcjach tego auta nie znaleźliśmy tabel z danymi technicznymi.
        </p>
      )}
      <div className="mt-6 space-y-8">
        {cards.map((card) => (
          <section key={card.href}>
            <h2 className="section-label">
              <span>{card.section}</span>
              {card.book && (
                <span className="font-normal tracking-normal text-steel normal-case">
                  · {card.book}
                </span>
              )}
            </h2>
            <div className="space-y-4">
              {card.tables.map((t) => (
                <div key={t.id} className="panel">
                  {t.kind === "facts" ? (
                    <dl className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
                      {t.facts.map((f, i) => (
                        <div key={i} className="bg-white px-4 py-3">
                          <dt className="text-sm text-graphite">{f.label}</dt>
                          <dd
                            className={`mt-1 leading-tight font-semibold tabular-nums ${
                              isNumeric(f.value) ? "text-2xl" : "text-lg"
                            }`}
                          >
                            {f.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {t.rows.map((row, r) => (
                            <tr
                              key={r}
                              className={
                                t.header && r === 0
                                  ? "silver-bar font-semibold"
                                  : "border-b border-line last:border-0"
                              }
                            >
                              {row.map((cell, c) =>
                                t.header && r === 0 ? (
                                  <th
                                    key={c}
                                    scope="col"
                                    className="px-3 py-2 text-left"
                                  >
                                    {cell}
                                  </th>
                                ) : (
                                  <td
                                    key={c}
                                    className={`px-3 py-2 align-top ${isNumeric(cell) ? "font-semibold tabular-nums" : ""}`}
                                  >
                                    {cell}
                                  </td>
                                ),
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="border-t border-line px-4 py-2 text-right text-sm">
                    <Link href={t.href} className="text-red hover:underline">
                      Pokaż w instrukcji ›
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
