import Link from "next/link";
import { EquipmentEditor } from "@/components/EquipmentEditor";
import { CarHero } from "@/components/car/CarHero";
import { Skeleton } from "@/components/Skeleton";
import type { CarSpec } from "@/lib/catalog";
import type { CarFeatureSections, CarSummary } from "@/lib/cars";
import { plural } from "@/lib/typography";
import { Progress, WizardMotion } from "./WizardChrome";
import type { Job, JobDoc } from "./wizardModel";

export const DOC_STATE: Record<JobDoc["state"], string> = {
  queued: "Czeka",
  running: "Odczytywanie…",
  done: "Gotowe",
  error: "Błąd",
};

export function StepProcessing({
  upload,
  job,
  picked,
  error,
  onBack,
}: {
  upload: number | null;
  job: Job | null;
  /** Files chosen in step 1, in upload order (empty after reopening). */
  picked: { title: string; name: string; preview: string | null }[];
  error: string | null;
  onBack: () => void;
}) {
  const uploading = !job && !error;
  const done = job?.docs.filter((d) => d.state === "done").length ?? 0;
  const total = job?.docs.length ?? 0;
  const failed = Boolean(error) || job?.state === "error";
  return (
    <section className="mt-6 flex flex-col gap-4">
      <div className="panel">
        <h2 className="panel-title">
          {job?.label ? `Odczytywanie: ${job.label}` : "Przesyłanie plików"}
        </h2>
        <div className="p-4 text-sm">
          <Progress
            label={
              uploading
                ? `Przesyłanie plików: ${upload ?? 0}%`
                : `Gotowe instrukcje: ${done} z ${total}`
            }
            value={uploading ? (upload ?? 0) : total ? (done / total) * 100 : 0}
          />
          {uploading && upload === 100 && (
            <p className="mt-2 text-steel">Przygotowywanie…</p>
          )}
          {job?.state === "running" && !error && (
            <p className="mt-2 text-graphite">
              To może potrwać kilka minut przy dużych instrukcjach. Możesz
              zamknąć tę kartę – postęp zobaczysz po ponownym otwarciu „Dodaj
              auto”. Nie wyłączaj tylko komputera, na którym działa aplikacja.
            </p>
          )}
          {failed && (
            <div className="mt-3 border-l-4 border-red bg-paper px-3 py-2">
              <p className="font-semibold text-red">Nie udało się dodać auta</p>
              <p className="mt-1">{error ?? job?.error}</p>
              <p className="mt-1 text-xs text-graphite">
                Nic nie zostało zapisane
                {job?.pdfsDeleted ? ", a przesłane pliki PDF usunięto" : ""}.
                Upewnij się, że pliki to instrukcje w PDF (nie zdjęcia ani
                skany) i spróbuj ponownie.
              </p>
              <button type="button" className="btn mt-2" onClick={onBack}>
                ← Wróć do formularza
              </button>
            </div>
          )}
        </div>
      </div>
      {(job?.docs.length || picked.length) > 0 && (
        <ol className="film-strip" aria-label="Instrukcje">
          {(job?.docs.length
            ? job.docs.map((d) => ({
                doc: d,
                preview:
                  d.size > 0
                    ? picked.find(
                        (p) => p.name === d.name && p.title.trim() === d.title,
                      )?.preview
                    : null,
              }))
            : picked.map((p) => ({
                doc: null,
                preview: p.preview,
                title: p.title,
              }))
          ).map((item, i) => {
            const d = item.doc;
            const state = d?.state ?? "queued";
            const title = d?.title ?? ("title" in item ? item.title : "");
            return (
              <li
                key={d?.bookId ?? i}
                className="film-frame"
                data-state={state}
              >
                <div className="relative flex aspect-3/4 items-center justify-center overflow-hidden border-b border-line bg-paper">
                  {item.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL
                    <img
                      src={item.preview}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="px-2 text-center text-xs text-steel">
                      {title}
                    </span>
                  )}
                  <span className="absolute top-0 left-0 bg-ink px-1.5 py-0.5 text-xs text-white">
                    {i + 1}
                  </span>
                  <span
                    className="film-progress"
                    role="progressbar"
                    aria-label={`${title}: ${DOC_STATE[state]}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={
                      state === "done" || state === "error"
                        ? 100
                        : state === "queued"
                          ? 0
                          : undefined
                    }
                  >
                    <span />
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2 text-xs text-graphite">
                  <span
                    className="truncate text-sm font-semibold text-ink"
                    title={title}
                  >
                    {title}
                  </span>
                  <span
                    className={
                      state === "error"
                        ? "font-semibold text-red"
                        : state === "running"
                          ? "font-semibold text-ink"
                          : ""
                    }
                  >
                    {DOC_STATE[state]}
                  </span>
                  {d?.pages != null && (
                    <span>
                      {d.pages} {plural(d.pages, "strona", "strony", "stron")}
                    </span>
                  )}
                  {d?.state === "done" && d.sections != null && (
                    <span>
                      {d.sections}{" "}
                      {plural(
                        d.sections,
                        "rozdział",
                        "rozdziały",
                        "rozdziałów",
                      )}
                    </span>
                  )}
                  {d?.state === "done" && d.images != null && (
                    <span>
                      {d.images}{" "}
                      {plural(
                        d.images,
                        "ilustracja",
                        "ilustracje",
                        "ilustracji",
                      )}
                    </span>
                  )}
                  {d?.state === "error" && (d.error || d.log.length > 0) && (
                    <details className="mt-1">
                      <summary className="text-steel">
                        Szczegóły (dla osoby technicznej)
                      </summary>
                      <pre className="mt-1 max-h-24 overflow-auto bg-paper px-2 py-1 text-[11px] whitespace-pre-wrap">
                        {[d.error, ...d.log.slice(-4)]
                          .filter(Boolean)
                          .join("\n")}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function StepEquipment({
  job,
  equipment,
  onRetry,
  onNext,
}: {
  job: Job;
  equipment:
    | { state: "loading" }
    | {
        state: "done";
        sections: CarFeatureSections;
        engines: CarSpec[];
        catalog?: { brand: string; model: string };
        year: number;
      }
    | { state: "error" }
    | null;
  onRetry: () => void;
  onNext: () => void;
}) {
  return (
    <section className="mt-6 flex flex-col gap-4">
      <div className="panel">
        <h2 className="panel-title">Wyposażenie: {job.label}</h2>
        <div className="space-y-2 p-4 text-sm text-graphite">
          <p>
            Instrukcje opisują też wyposażenie dostępne tylko w niektórych
            wersjach auta. Zaznacz, co ma Twoje auto – sekcje o wyposażeniu,
            którego nie masz, zostaną zwinięte. Gdy nie masz pewności, zostaw
            „Nie wiem”: wtedy nic nie jest ukrywane.
          </p>
          <p className="text-xs text-steel">
            Wszystko zmienisz później na stronie głównej.
          </p>
        </div>
      </div>
      <WizardMotion>
        {(!equipment || equipment.state === "loading") && (
          <div className="panel" aria-busy="true">
            <div className="panel-title">
              <Skeleton className="h-3 w-40" />
            </div>
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex min-h-16 items-center gap-3 border-b border-line px-4 py-3"
              >
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-8 w-40 shrink-0" />
              </div>
            ))}
          </div>
        )}
        {equipment?.state === "error" && (
          <div className="flex flex-col gap-2 border-l-4 border-red bg-paper px-4 py-3 text-sm sm:flex-row sm:items-center">
            <p className="flex-1">
              Nie udało się wczytać listy wyposażenia. Możesz spróbować ponownie
              albo uzupełnić ją później.
            </p>
            <button type="button" className="btn shrink-0" onClick={onRetry}>
              Spróbuj ponownie
            </button>
          </div>
        )}
        {equipment?.state === "done" && (
          <EquipmentEditor
            carId={job.carId}
            engines={equipment.engines}
            catalog={equipment.catalog}
            year={equipment.year}
            sections={equipment.sections}
          />
        )}
      </WizardMotion>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Dalej →
        </button>
      </div>
    </section>
  );
}

export function StepDone({
  job,
  car,
  onOpen,
  onAgain,
}: {
  job: Job;
  car: CarSummary | null;
  onOpen: () => void;
  onAgain: () => void;
}) {
  const sum = (key: "pages" | "sections" | "images") =>
    job.docs.reduce((n, d) => n + (d[key] ?? 0), 0);
  const numbers = [
    {
      n: job.docs.length,
      label: plural(job.docs.length, "instrukcja", "instrukcje", "instrukcji"),
    },
    {
      n: sum("pages"),
      label: plural(sum("pages"), "strona", "strony", "stron"),
    },
    {
      n: sum("sections"),
      label: plural(sum("sections"), "rozdział", "rozdziały", "rozdziałów"),
    },
    {
      n: sum("images"),
      label: plural(sum("images"), "ilustracja", "ilustracje", "ilustracji"),
    },
  ].filter((x) => x.n > 0);

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="min-w-0 space-y-px">
        {car ? (
          <CarHero
            carId={car.id}
            brand={car.brand}
            model={car.model}
            year={car.year}
            variant={car.spec ? undefined : car.variant}
            badge="Dodano"
            heading="h2"
          />
        ) : (
          <div className="car-hero p-5 sm:p-7">
            <span className="badge badge-red mb-2">Dodano</span>
            <h2 className="type-display">{job.label}</h2>
          </div>
        )}
        {numbers.length > 0 && (
          <ul className="stat-strip" aria-label="Odczytane instrukcje">
            {numbers.map((x) => (
              <li key={x.label} className="stat-cell">
                <span className="type-value block">
                  {x.n.toLocaleString("pl-PL")}
                </span>
                <span className="mt-1.5 block text-xs text-graphite">
                  {x.label}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="border border-line bg-white p-4 text-sm">
          <ul className="flex flex-wrap gap-2">
            {job.docs.map((d) => (
              <li key={d.bookId} className="car-hero-spec font-normal">
                {d.title}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Instrukcje są gotowe do czytania.{" "}
            {job.docs.some((d) => d.size > 0) &&
              (job.pdfsDeleted
                ? "Przesłane pliki PDF zostały usunięte – nie są już potrzebne."
                : "Uwaga: nie udało się potwierdzić usunięcia przesłanych plików PDF.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={onOpen}>
              Otwórz instrukcje auta
            </button>
            <button type="button" className="btn" onClick={onAgain}>
              Dodaj kolejne auto
            </button>
            <Link href="/" className="btn btn-ghost">
              Profil
            </Link>
          </div>
        </div>
      </div>
      <div className="panel text-sm">
        <h2 className="panel-title">Co dalej?</h2>
        <ul className="flex list-[square] flex-col gap-2 py-3 pr-4 pl-8 text-graphite marker:text-red">
          <li>
            Auto zostało dodane do Twoich aut. Instrukcje są dostępne w tej
            aplikacji na tym komputerze.
          </li>
          <li>Wyposażenie auta zmienisz w każdej chwili na jego stronie.</li>
          <li>
            Po otwarciu auta jego instrukcje zapiszą się same, aby działały też
            bez internetu.
          </li>
          <li>
            W instrukcji możesz zaznaczać tekst, dodawać komentarze i zakładki.
          </li>
        </ul>
      </div>
    </section>
  );
}
