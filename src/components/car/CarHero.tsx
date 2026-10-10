"use client";

import type { ReactNode } from "react";
import { useCarEngine } from "@/lib/storage/hooks";
import { specParts } from "@/lib/overview";
import { CarLogo } from "../CarLogo";

/**
 * Large car card in the spirit of the Navi 950 home screen: brand logo,
 * model and year in large type and the engine from the official catalogue.
 * Used on the car page and in the last step of the add-car wizard.
 */
export function CarHero({
  carId,
  brand,
  model,
  year,
  variant,
  badge,
  heading: Heading = "h1",
  children,
}: {
  carId: string;
  brand: string;
  model: string;
  year: number;
  variant?: string;
  badge?: string;
  /** Heading level of the model name (h2 inside the wizard). */
  heading?: "h1" | "h2";
  children?: ReactNode;
}) {
  const spec = useCarEngine(carId);
  const engine = spec ? specParts(spec) : [];
  return (
    <section className="car-hero">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
        <div className="car-hero-logo">
          <CarLogo
            carId={carId}
            brand={brand}
            size={72}
            fill
            className="text-black"
          />
        </div>
        <div className="min-w-0 flex-1">
          {badge && <span className="badge badge-red mb-2">{badge}</span>}
          <p className="text-sm font-semibold tracking-[0.14em] text-steel uppercase">
            {brand}
          </p>
          <Heading className="type-display">
            {model} <span className="font-normal text-steel">{year}</span>
          </Heading>
          <div className="mt-3 min-h-8">
            {engine.length > 0 ? (
              <ul className="flex flex-wrap gap-2 text-sm">
                {engine.map((part) => (
                  <li key={part} className="car-hero-spec">
                    {part}
                  </li>
                ))}
              </ul>
            ) : (
              variant && <p className="mt-2 text-graphite">{variant}</p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
