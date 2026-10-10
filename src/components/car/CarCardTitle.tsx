import type { CarSummary } from "@/lib/cars";

/** Model, year and variant of a car card in the car lists. */
export function CarCardTitle({
  car,
}: {
  car: Pick<CarSummary, "model" | "year" | "variant">;
}) {
  return (
    <>
      <h3 className="type-card">
        {car.model} <span className="font-normal text-steel">{car.year}</span>
      </h3>
      {car.variant && (
        <p className="mt-1 text-sm text-graphite">{car.variant}</p>
      )}
    </>
  );
}
