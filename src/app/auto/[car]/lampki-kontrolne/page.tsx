import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carHref, carLabel } from "@/lib/cars";
import { getGlossary } from "@/lib/carOverview";
import { getCar } from "@/lib/content";
import { polishTypography } from "@/lib/typography";
import { GlossaryGrid } from "./GlossaryGrid";

type Props = PageProps<"/auto/[car]/lampki-kontrolne">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const car = getCar((await params).car);
  return {
    title: car ? `Lampki kontrolne – ${carLabel(car)}` : "Nie znaleziono",
  };
}

/** Symbols printed in the manuals with their explanation (docs/car-overview.md). */
export default async function GlossaryPage({ params }: Props) {
  const car = getCar((await params).car);
  if (!car) notFound();
  const groups = getGlossary(car).map((g) => ({
    ...g,
    items: g.items.map((i) => ({ ...i, text: polishTypography(i.text) })),
  }));

  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Lampki kontrolne i symbole</h1>
      <p className="mt-3 max-w-3xl text-graphite">
        Symbole z instrukcji{" "}
        <Link href={carHref(car.id)} className="text-red hover:underline">
          {carLabel(car)}
        </Link>{" "}
        razem z opisem. Wybierz symbol, aby przeczytać cały fragment instrukcji.
      </p>
      {groups.length === 0 ? (
        <p className="panel mt-6 p-4 text-graphite">
          W instrukcjach tego auta nie znaleźliśmy symboli z opisem.
        </p>
      ) : (
        <GlossaryGrid groups={groups} />
      )}
    </main>
  );
}
