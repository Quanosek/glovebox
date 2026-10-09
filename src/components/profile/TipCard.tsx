"use client";

import Link from "next/link";
import { useState } from "react";
import { carName, type CarSummary } from "@/lib/cars";
import type { Tip } from "@/lib/overview";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { useAppData, useHydrated } from "@/lib/storage/hooks";

/** "Czy wiesz, że…": a random note from the manuals of the profile's cars. */
export function TipCard({
  tips,
  cars,
  seed,
}: {
  tips: Tip[];
  cars: CarSummary[];
  /** Random start in [0, 1), chosen by the server for this page view. */
  seed: number;
}) {
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const { settings } = useAppData();
  const [step, setStep] = useState(0);
  const owned = hydrated ? settings.ownedCars : hint.ownedCars;
  const own = tips.filter((t) => owned.includes(t.car));
  if (own.length === 0) return null;
  const tip = own[(Math.floor(seed * own.length) + step) % own.length];

  return (
    <section
      className="panel border-l-4 border-l-red"
      aria-labelledby="tip-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <h2 id="tip-title" className="section-label mb-0">
          Czy wiesz, że…
        </h2>
        {own.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost h-8 py-0 text-sm"
            onClick={() => setStep((s) => s + 1)}
          >
            Następna wskazówka ›
          </button>
        )}
      </div>
      <div className="p-4" aria-live="polite">
        <p className="text-lg leading-relaxed">{tip.text}</p>
        <p className="mt-3 text-sm text-steel">
          {carName(cars, tip.car)} · {tip.section} ·{" "}
          <Link href={tip.href} className="text-red hover:underline">
            Przeczytaj w instrukcji ›
          </Link>
        </p>
      </div>
    </section>
  );
}
