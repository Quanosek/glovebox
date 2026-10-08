import type { Metadata } from "next";
import { VEHICLE_SUMMARY } from "@/config/vehicle";
import { notFound } from "next/navigation";
import { CASCADA_CAR_ID } from "@/lib/cars";
import { getCar, getFeatureSections } from "@/lib/content";
import { VehicleView } from "./VehicleView";

export const metadata: Metadata = { title: "Wyposażenie – Opel Cascada" };

/** Equipment profile of the Opel Cascada MY16 (the only profiled car). */
export default function VehiclePage() {
  const car = getCar(CASCADA_CAR_ID);
  if (!car) notFound();
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8"
    >
      <h1 className="border-b-2 border-red pb-2 text-2xl font-semibold">
        Twoje auto – wyposażenie
      </h1>
      <dl className="mt-4 grid gap-px border border-line bg-line text-sm sm:grid-cols-2">
        {[
          ["Model", `${VEHICLE_SUMMARY.model} ${VEHICLE_SUMMARY.modelYear}`],
          ["Silnik", VEHICLE_SUMMARY.engine],
          ["Skrzynia biegów", VEHICLE_SUMMARY.transmission],
          ["System multimedialny", VEHICLE_SUMMARY.infotainment],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-2">
            <dt className="text-xs tracking-[0.08em] text-steel uppercase">
              {k}
            </dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="panel mt-6">
        <h2 className="panel-title">OnStar</h2>
        <div className="p-4 text-sm">
          <p className="border-l-4 border-red bg-paper px-3 py-2 font-semibold">
            Usługa OnStar nie działa już w Europie – przyciski pozostają
            nieaktywne.
          </p>
          <p className="mt-3 text-graphite">
            W lusterku wstecznym znajdują się trzy przyciski systemu OnStar:
            przycisk z logo OnStar (połączenie z konsultantem), przycisk SOS
            (połączenie alarmowe) oraz przycisk słuchawki (połączenia głosowe).
            Dioda statusu informowała o stanie systemu. Opel zakończył
            świadczenie usługi OnStar w Europie, dlatego naciśnięcie przycisków
            nie nawiązuje połączenia. W razie wypadku dzwoń bezpośrednio pod
            numer alarmowy 112. Opisy z instrukcji pozostają w aplikacji w
            celach informacyjnych.
          </p>
        </div>
      </section>

      <VehicleView featureSections={getFeatureSections(car)} />
    </main>
  );
}
