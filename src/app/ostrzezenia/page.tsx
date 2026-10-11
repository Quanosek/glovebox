import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAllWarnings, getCar, getCarSummary } from "@/lib/content";
import { blockToText } from "@/lib/overview";
import { WarningsList, type WarningItem } from "./WarningsList";

export const metadata: Metadata = { title: "Ostrzeżenia" };

export default async function WarningsPage({
  searchParams,
}: PageProps<"/ostrzezenia">) {
  const { car } = await searchParams;
  if (typeof car !== "string") redirect("/");
  const file = getCar(car);
  if (!file) redirect("/");
  const selectedCar = getCarSummary(file);
  const items: WarningItem[] = getAllWarnings()
    .filter((warning) => warning.car === selectedCar.id)
    .map((w) => ({
      id: `${w.car}:${w.book.id}:${w.section.id}:${w.block.id}`,
      car: w.car,
      book: w.book.short,
      kind: w.block.kind,
      title: w.block.title,
      section: w.section.title,
      href: w.href,
      page: w.block.page ?? w.section.page,
      text: w.block.blocks.map(blockToText).join(" "),
      features: w.features,
    }));

  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Ostrzeżenia z instrukcji</h1>
      <h2 className="type-card mt-4">{selectedCar.label}</h2>
      <p className="mt-2 text-sm text-graphite">
        Ostrzeżenia, przestrogi i uwagi z instrukcji tego auta.
      </p>
      <WarningsList carId={selectedCar.id} items={items} />
    </main>
  );
}
