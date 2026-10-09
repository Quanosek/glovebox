import type { Metadata } from "next";
import { RemindersView } from "@/components/reminders/RemindersView";
import { getCarOverview } from "@/lib/carOverview";
import { listCarSummaries, listCars } from "@/lib/content";
import { polishTypography } from "@/lib/typography";

const INTRO =
  "Terminy badania technicznego, ubezpieczenia OC i własne przypomnienia dla każdego auta. Na 30 dni przed terminem liczba przy „Przypomnienia” w menu i kafelek na stronie auta przypomną Ci o nim. Terminy zapisują się tylko na tym urządzeniu.";

export const metadata: Metadata = { title: "Przypomnienia" };

export default function RemindersPage() {
  const serviceHrefs: Record<string, string> = {};
  for (const car of listCars()) {
    const href = getCarOverview(car).serviceHref;
    if (href) serviceHrefs[car.id] = href;
  }
  return (
    <main id="main" className="page-shell">
      <h1 className="page-title">Przypomnienia</h1>
      <p className="mt-2 mb-6 max-w-3xl text-graphite">
        {/* Typeset on the server, so the client pass does not reflow it. */}
        {polishTypography(INTRO, { lastWord: true })}
      </p>
      <RemindersView cars={listCarSummaries()} serviceHrefs={serviceHrefs} />
    </main>
  );
}
