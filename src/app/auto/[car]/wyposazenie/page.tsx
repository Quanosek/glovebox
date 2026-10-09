import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EquipmentEditor } from "@/components/EquipmentEditor";
import { carLabel } from "@/lib/cars";
import { getCar, getCarSummary, getFeatureSections } from "@/lib/content";

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
      <h1 className="page-title">Wyposażenie – {car.label}</h1>
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
    </main>
  );
}
