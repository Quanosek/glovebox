import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarActions } from "@/components/CarActions";
import { CarLogo } from "@/components/CarLogo";
import { ContinueReading } from "@/components/ContinueReading";
import { EquipmentEditor } from "@/components/EquipmentEditor";
import { bookHref, carLabel } from "@/lib/cars";
import { getCar, getCarSummary, getFeatureSections } from "@/lib/content";
import { plural } from "@/lib/typography";

type Props = PageProps<"/auto/[car]/wyposazenie">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const car = getCar((await params).car);
  return { title: car ? carLabel(car) : "Nie znaleziono" };
}

/** Equipment of one car, chosen by the owner from what its manuals describe. */
export default async function EquipmentPage({ params }: Props) {
  const file = getCar((await params).car);
  if (!file) notFound();
  const car = getCarSummary(file);
  const facts: [string, string][] = [
    ["Marka", car.brand],
    ["Model", car.model],
    ["Rocznik", String(car.year)],
    ...(car.spec
      ? [["Silnik", car.spec.label] as [string, string]]
      : car.variant
        ? [["Wersja", car.variant] as [string, string]]
        : []),
  ];

  return (
    <main id="main" className="page-shell">
      <section className="flex flex-col items-start gap-4 border-b-2 border-red pb-6 sm:flex-row sm:items-center">
        <CarLogo
          carId={car.id}
          brand={car.brand}
          size={56}
          className="shrink-0 text-black"
        />
        <div className="min-w-0 flex-1">
          <span className="badge badge-red mb-2">Wybrane auto</span>
          <p className="text-xs tracking-[0.12em] text-steel uppercase">
            {car.brand}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {car.model} <span className="text-steel">{car.year}</span>
          </h1>
          {car.variant && <p className="mt-1 text-graphite">{car.variant}</p>}
        </div>
      </section>

      <section aria-labelledby="car-tools-title" className="mt-6">
        <h2
          id="car-tools-title"
          className="mb-3 text-xs font-semibold tracking-[0.08em] text-graphite uppercase"
        >
          Dla tego auta
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/szukaj?car=${car.id}`}
            className="panel hover-tile group block p-4"
          >
            <h3 className="font-semibold group-hover:text-red">
              Szukaj w instrukcjach
            </h3>
            <p className="mt-1 text-sm text-graphite">
              Szukaj we wszystkich instrukcjach tego auta.
            </p>
          </Link>
          <Link
            href={`/ostrzezenia?car=${car.id}`}
            className="panel hover-tile group block p-4"
          >
            <h3 className="font-semibold group-hover:text-red">Ostrzeżenia</h3>
            <p className="mt-1 text-sm text-graphite">
              Ostrzeżenia, przestrogi i uwagi z instrukcji.
            </p>
          </Link>
        </div>
      </section>

      <div className="mt-5">
        <ContinueReading car={car.id} carLabel={car.label} />
      </div>

      <section aria-labelledby="car-books-title" className="mt-6">
        <h2
          id="car-books-title"
          className="mb-3 text-xs font-semibold tracking-[0.08em] text-graphite uppercase"
        >
          Instrukcje ({car.books.length})
        </h2>
        {car.books.length === 0 ? (
          <p className="text-sm text-steel">
            To auto nie ma jeszcze żadnych instrukcji.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {car.books.map((book) => (
              <li key={book.id}>
                <Link
                  href={bookHref(car.id, book.route)}
                  className="panel hover-tile group block p-4"
                >
                  <h3 className="font-semibold group-hover:text-red">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-sm text-graphite">
                    {book.placeholder
                      ? "Treść nie jest jeszcze gotowa."
                      : `${book.sections} ${plural(book.sections, "sekcja", "sekcje", "sekcji")}${book.pages ? ` · ${book.pages} ${plural(book.pages, "strona", "strony", "stron")}` : ""}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="equipment-title" className="mt-8">
        <h2 id="equipment-title" className="page-title">
          Wyposażenie
        </h2>
        <dl className="mt-4 grid gap-px border border-line bg-line text-sm sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="bg-white px-4 py-2">
              <dt className="text-xs tracking-[0.08em] text-steel uppercase">
                {k}
              </dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 mb-6 text-sm text-graphite">
          Instrukcje opisują też wyposażenie, które było dostępne tylko w
          niektórych wersjach. Zaznacz, co ma Twoje auto. Sekcje o wyposażeniu,
          którego nie masz, zostaną zwinięte i oznaczone jako „Brak w Twoim
          aucie”, a te o Twoim wyposażeniu – jako „Twoje auto”. Gdy nie masz
          pewności, zostaw „Nie wiem”.
        </p>
        <EquipmentEditor
          carId={car.id}
          spec={car.spec}
          sections={getFeatureSections(file)}
        />
      </section>
      <div className="mt-6">
        <CarActions carId={car.id} label={car.label} />
      </div>
    </main>
  );
}
