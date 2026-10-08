import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarActions } from "@/components/CarActions";
import { ContinueReading } from "@/components/ContinueReading";
import { Logo } from "@/components/Logo";
import { carLabel } from "@/lib/cars";
import { getCar, getCarSummary } from "@/lib/content";

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
      title: "Wyszukiwarka",
      text: "Pełnotekstowe wyszukiwanie we wszystkich instrukcjach tego auta.",
    },
    {
      href: `/ostrzezenia?car=${car.id}`,
      title: "Ostrzeżenia",
      text: "Ostrzeżenia, przestrogi i uwagi z instrukcji.",
    },
    ...(car.hasProfile
      ? [
          {
            href: "/twoje-auto",
            title: "Wyposażenie",
            text: "Profil wyposażenia i funkcje do weryfikacji.",
          },
        ]
      : []),
    {
      href: "/komentarze",
      title: "Moje komentarze",
      text: "Zaznaczenia i komentarze.",
    },
    { href: "/zakladki", title: "Zakładki", text: "Zapisane sekcje." },
    { href: "/notatnik", title: "Notatnik", text: "Własne notatki." },
  ];

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8"
    >
      <nav aria-label="Ścieżka" className="mb-4 text-xs text-steel">
        <Link href="/" className="hover:text-red">
          Profil
        </Link>{" "}
        ›{" "}
        <Link href="/auta" className="hover:text-red">
          Auta
        </Link>{" "}
        › <span className="text-ink">{car.label}</span>
      </nav>
      <section className="flex flex-col items-start gap-5 border-b-2 border-red pb-6 sm:flex-row sm:items-center">
        <Logo size={64} className="shrink-0 text-black" />
        <div>
          <p className="text-xs tracking-[0.12em] text-steel uppercase">
            {car.brand}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {car.model} <span className="text-steel">{car.year}</span>
          </h1>
          {car.variant && <p className="mt-1 text-graphite">{car.variant}</p>}
        </div>
      </section>

      <div className="mt-6">
        <ContinueReading car={car.id} />
      </div>

      <h2 className="mt-8 mb-2 text-xs font-semibold tracking-[0.08em] text-graphite uppercase">
        Instrukcje ({car.books.length})
      </h2>
      {car.books.length === 0 ? (
        <p className="text-steel">To auto nie ma jeszcze żadnych instrukcji.</p>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {car.books.map((b) => (
            <Link
              key={b.id}
              href={b.href}
              className="panel group block hover:border-silver"
            >
              <div className="panel-title">Księga</div>
              <div className="p-5">
                <h3 className="text-xl font-semibold group-hover:text-red">
                  {b.title}
                </h3>
                <p className="mt-1 text-sm text-graphite">
                  {b.placeholder
                    ? "Treść do wygenerowania z pliku PDF."
                    : `${b.sections} sekcji${b.pages ? ` · ${b.pages} stron` : ""}`}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}

      <section className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group bg-white p-4 hover:bg-paper"
          >
            <h3 className="font-semibold group-hover:text-red">{t.title}</h3>
            <p className="mt-1 text-sm text-graphite">{t.text}</p>
          </Link>
        ))}
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]">
        <CarActions carId={car.id} label={car.label} builtIn={car.builtIn} />
        <div className="panel">
          <div className="panel-title">Gdzie są dane</div>
          <div className="space-y-2 p-4 text-sm text-graphite">
            <p>
              Treść instrukcji: <code>database/{car.id}/</code> (pliki JSON i
              ilustracje WebP). Folder jest częścią repozytorium — po
              zatwierdzeniu go w git auto będzie dostępne na każdym urządzeniu.
            </p>
            <p>
              Twoje zaznaczenia, komentarze i notatki są tylko w tej
              przeglądarce.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
