import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarActions } from "@/components/CarActions";
import { CarLogo } from "@/components/CarLogo";
import { ContinueReading } from "@/components/ContinueReading";
import { carLabel, equipmentHref } from "@/lib/cars";
import { getCar, getCarSummary } from "@/lib/content";
import { plural } from "@/lib/typography";

type Props = PageProps<"/auto/[car]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const car = getCar((await params).car);
  return { title: car ? carLabel(car) : "Nie znaleziono" };
}

export default async function CarPage({ params }: Props) {
  const file = getCar((await params).car);
  if (!file) notFound();
  const car = getCarSummary(file);

  const tiles = [
    {
      href: `/szukaj?car=${car.id}`,
      title: "Szukaj w instrukcjach",
      text: "Szukaj we wszystkich instrukcjach tego auta.",
    },
    {
      href: `/ostrzezenia?car=${car.id}`,
      title: "Ostrzeżenia",
      text: "Ostrzeżenia, przestrogi i uwagi z instrukcji.",
    },
  ];

  return (
    <main id="main" className="page-shell">
      <section className="flex flex-col items-start gap-4 border-b-2 border-red pb-6 sm:flex-row sm:items-center">
        <CarLogo
          carId={car.id}
          brand={car.brand}
          size={64}
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
        <Link
          href={equipmentHref(car.id)}
          className="btn btn-primary shrink-0 justify-center"
        >
          Dostosuj wyposażenie
        </Link>
      </section>

      <section aria-labelledby="car-tools-title" className="mt-6">
        <h2
          id="car-tools-title"
          className="mb-3 text-xs font-semibold tracking-[0.08em] text-graphite uppercase"
        >
          Dla tego auta
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="panel hover-tile group block p-4"
            >
              <h3 className="font-semibold group-hover:text-red">
                {tile.title}
              </h3>
              <p className="mt-1 text-sm text-graphite">{tile.text}</p>
            </Link>
          ))}
        </div>
      </section>

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
                  href={book.href}
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

      <div className="mt-5">
        <ContinueReading car={car.id} carLabel={car.label} />
      </div>

      <div className="mt-6">
        <CarActions carId={car.id} label={car.label} />
      </div>
    </main>
  );
}
