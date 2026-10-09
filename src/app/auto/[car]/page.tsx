import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarActions } from "@/components/CarActions";
import { ContinueReading } from "@/components/ContinueReading";
import { CarHero } from "@/components/car/CarHero";
import { CarStatsStrip } from "@/components/car/CarStatsStrip";
import { FavoritesBar } from "@/components/car/FavoritesBar";
import { QuickTiles } from "@/components/car/QuickTiles";
import { ServiceReminders } from "@/components/car/ServiceReminders";
import { TechPreview } from "@/components/car/TechPreview";
import { carLabel, equipmentHref } from "@/lib/cars";
import { getCarOverview } from "@/lib/carOverview";
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
  const overview = getCarOverview(file);

  const tools = [
    {
      href: `/szukaj?car=${car.id}`,
      title: "Szukaj w instrukcjach",
      text: "Wpisz słowo, np. „olej” albo „wycieraczki”.",
    },
    {
      href: `/ostrzezenia?car=${car.id}`,
      title: "Ostrzeżenia",
      text: "Wszystkie ostrzeżenia, przestrogi i uwagi w jednym miejscu.",
    },
  ];

  return (
    <main id="main" className="page-shell space-y-8">
      <div className="space-y-px">
        <CarHero
          carId={car.id}
          brand={car.brand}
          model={car.model}
          year={car.year}
          variant={car.variant}
          spec={car.spec}
        >
          <Link
            href={equipmentHref(car.id)}
            className="btn btn-primary justify-center"
          >
            Dostosuj wyposażenie
          </Link>
        </CarHero>
        <CarStatsStrip carId={car.id} stats={overview.stats} />
      </div>

      <ContinueReading car={car.id} carLabel={car.label} />

      <FavoritesBar carId={car.id} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-8">
          <QuickTiles tiles={overview.tiles} />

          <section aria-labelledby="car-books-title">
            <h2 id="car-books-title" className="section-label">
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
                      className="panel hover-tile group flex h-full items-start gap-3 p-4"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 h-10 w-1 shrink-0 bg-silver transition-colors group-hover:bg-red"
                      />
                      <span className="min-w-0">
                        <span className="block text-lg leading-snug font-semibold group-hover:text-red">
                          {book.title}
                        </span>
                        <span className="mt-1 block text-sm text-graphite">
                          {book.placeholder
                            ? "Treść nie jest jeszcze gotowa."
                            : `${book.sections} ${plural(book.sections, "rozdział", "rozdziały", "rozdziałów")}${book.pages ? ` · ${book.pages} ${plural(book.pages, "strona", "strony", "stron")}` : ""}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="car-tools-title">
            <h2 id="car-tools-title" className="section-label">
              Narzędzia
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {tools.map((tool) => (
                <li key={tool.href}>
                  <Link
                    href={tool.href}
                    className="panel hover-tile group block h-full p-4"
                  >
                    <span className="block font-semibold group-hover:text-red">
                      {tool.title} ›
                    </span>
                    <span className="mt-1 block text-sm text-graphite">
                      {tool.text}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Dodatkowe informacje">
          <TechPreview
            carId={car.id}
            facts={overview.techPreview}
            tables={overview.techCount}
          />
          <ServiceReminders carId={car.id} serviceHref={overview.serviceHref} />
          <CarActions carId={car.id} label={car.label} />
        </aside>
      </div>
    </main>
  );
}
