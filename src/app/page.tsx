import Link from "next/link";
import { ContinueReading } from "@/components/ContinueReading";
import { Logo } from "@/components/Logo";
import { VEHICLE_SUMMARY } from "@/config/vehicle";
import { BOOKS, getBook } from "@/lib/content";

const TILES = [
  { href: "/szukaj", title: "Wyszukiwarka", text: "Pełnotekstowe wyszukiwanie w obu instrukcjach." },
  { href: "/twoje-auto", title: "Twoje auto", text: "Profil wyposażenia i funkcje do weryfikacji." },
  { href: "/ostrzezenia", title: "Ostrzeżenia", text: "Wszystkie ostrzeżenia, przestrogi i uwagi." },
  { href: "/komentarze", title: "Moje komentarze", text: "Zaznaczenia i komentarze z całej instrukcji." },
  { href: "/zakladki", title: "Zakładki", text: "Zapisane sekcje instrukcji." },
  { href: "/notatnik", title: "Notatnik", text: "Puste kartki na własne notatki." },
];

export default function Home() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
      <section className="flex flex-col items-start gap-5 border-b-2 border-red pb-6 sm:flex-row sm:items-center">
        <Logo size={72} className="shrink-0 text-black" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {VEHICLE_SUMMARY.model} <span className="text-steel">{VEHICLE_SUMMARY.modelYear}</span>
          </h1>
          <p className="mt-1 text-graphite">
            {VEHICLE_SUMMARY.engine} · skrzynia {VEHICLE_SUMMARY.transmission} · {VEHICLE_SUMMARY.infotainment}
          </p>
        </div>
      </section>

      <div className="mt-6">
        <ContinueReading />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {BOOKS.map((b) => {
          const index = getBook(b.id);
          return (
            <Link key={b.id} href={`/${b.route}`} className="panel group block hover:border-silver">
              <div className="panel-title">Księga</div>
              <div className="p-5">
                <h2 className="text-xl font-semibold group-hover:text-red">{index.title}</h2>
                <p className="mt-1 text-sm text-graphite">
                  {index.placeholder
                    ? "Treść do wygenerowania z pliku PDF (npm run extract)."
                    : `${index.sections.length} sekcji${index.source.pages ? ` · ${index.source.pages} stron` : ""}`}
                </p>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className="group bg-white p-4 hover:bg-paper">
            <h3 className="font-semibold group-hover:text-red">{t.title}</h3>
            <p className="mt-1 text-sm text-graphite">{t.text}</p>
          </Link>
        ))}
      </section>

      <p className="mt-8 text-xs text-steel">
        Aplikacja działa wyłącznie lokalnie. Zaznaczenia, komentarze, notatki i ustawienia są zapisywane
        tylko w pamięci tej przeglądarki (localStorage) — pamiętaj o regularnym eksporcie kopii w
        Ustawieniach.
      </p>
    </main>
  );
}
