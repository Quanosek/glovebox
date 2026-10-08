"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { CAR_CATALOG, CATALOG_BRANDS } from "@/config/carCatalog";
import { carHref, type CarSummary } from "@/lib/cars";
import { renderPdfPreview } from "@/lib/pdfPreview";
import { slugify } from "@/lib/slug";
import { setActiveCar } from "@/lib/storage/hooks";

/* ------------------------------------------------------------------ types */

interface SystemStatus {
  node: string;
  platform: string;
  python: {
    command: string;
    version: string;
    pymupdf: string | null;
    pillow: string | null;
  } | null;
  pythonReady: boolean;
  extractor: boolean;
  database: { path: string; writable: boolean };
  limits: { maxDocuments: number; maxFileBytes: number };
  runningJob: { id: string; label: string } | null;
}

interface JobDoc {
  name: string;
  title: string;
  bookId: string;
  size: number;
  state: "queued" | "running" | "done" | "error";
  pages?: number;
  sections?: number;
  images?: number;
  log: string[];
  error?: string;
}

interface Job {
  id: string;
  carId: string;
  label: string;
  state: "running" | "done" | "error";
  error?: string;
  pdfsDeleted: boolean;
  docs: JobDoc[];
}

interface PickedDoc {
  key: string;
  file: File;
  title: string;
  pages: number | null;
  preview: string | null;
  previewState: "loading" | "done" | "error";
}

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Wymagania" },
  { n: 2, label: "Auto i dokumenty" },
  { n: 3, label: "Przetwarzanie" },
  { n: 4, label: "Gotowe" },
];

const OTHER = "__other__";

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} kB`;

const titleFromName = (name: string) =>
  name
    .replace(/\.pdf$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ----------------------------------------------------------------- wizard */

export function AddCarWizard({
  cars,
  maxYear,
  minYear,
}: {
  cars: CarSummary[];
  maxYear: number;
  minYear: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Step 2 form.
  const [brandChoice, setBrandChoice] = useState("");
  const [brandOther, setBrandOther] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [modelOther, setModelOther] = useState("");
  const [year, setYear] = useState("");
  const [variant, setVariant] = useState("");
  const [docs, setDocs] = useState<PickedDoc[]>([]);
  const [notice, setNotice] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  // Steps 3–4.
  const [upload, setUpload] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const maxDocs = system?.limits.maxDocuments ?? 10;
  const maxBytes = system?.limits.maxFileBytes ?? 250 * 1024 * 1024;

  const brandIsOther = brandChoice === OTHER;
  const brand = brandIsOther ? brandOther.trim() : brandChoice;
  const models = brandIsOther ? [] : (CAR_CATALOG[brandChoice] ?? []);
  const modelIsOther = brandIsOther || modelChoice === OTHER;
  const model = modelIsOther ? modelOther.trim() : modelChoice;
  const targetId =
    brand && model && year ? slugify(`${brand} ${model} ${year}`, 70) : "";
  const duplicate = targetId
    ? cars.find(
        (c) =>
          slugify(c.brand) === slugify(brand) &&
          slugify(c.model) === slugify(model) &&
          String(c.year) === year,
      )
    : undefined;

  /* ---- step 1: environment check */

  const check = useCallback(async () => {
    setChecking(true);
    setSystemError(null);
    try {
      const r = await fetch("/api/system", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSystem((await r.json()) as SystemStatus);
    } catch (e) {
      setSystemError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void check();
  }, [check]);

  /* ---- step 2: documents */

  const previewQueue = useRef<Promise<void>>(Promise.resolve());
  const removed = useRef(new Set<string>());
  const docsRef = useRef(docs);
  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);
  useEffect(
    () => () => {
      for (const d of docsRef.current)
        if (d.preview) URL.revokeObjectURL(d.preview);
    },
    [],
  );

  const addFiles = (list: FileList | File[]) => {
    const messages: string[] = [];
    const next: PickedDoc[] = [];
    const known = new Set(
      docs.map((d) => `${d.file.name}:${d.file.size}:${d.file.lastModified}`),
    );
    for (const file of Array.from(list)) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
        messages.push(`Pominięto „${file.name}” — to nie jest plik PDF.`);
      } else if (known.has(key)) {
        messages.push(
          `Pominięto „${file.name}” — ten plik jest już na liście.`,
        );
      } else if (file.size > maxBytes) {
        messages.push(
          `Pominięto „${file.name}” — plik jest większy niż ${formatSize(maxBytes)}.`,
        );
      } else if (docs.length + next.length >= maxDocs) {
        messages.push(
          `Pominięto „${file.name}” — limit to ${maxDocs} dokumentów na jedno auto.`,
        );
      } else {
        known.add(key);
        next.push({
          key: `${key}:${crypto.randomUUID()}`,
          file,
          title: titleFromName(file.name),
          pages: null,
          preview: null,
          previewState: "loading",
        });
      }
    }
    setNotice(messages);
    if (next.length === 0) return;
    setDocs((prev) => [...prev, ...next]);
    // Render previews one at a time to keep memory use low.
    for (const d of next) {
      previewQueue.current = previewQueue.current.then(async () => {
        if (removed.current.has(d.key)) return;
        try {
          const p = await renderPdfPreview(d.file);
          if (removed.current.has(d.key)) {
            URL.revokeObjectURL(p.url);
            return;
          }
          setDocs((prev) =>
            prev.map((x) =>
              x.key === d.key
                ? { ...x, pages: p.pages, preview: p.url, previewState: "done" }
                : x,
            ),
          );
        } catch {
          setDocs((prev) =>
            prev.map((x) =>
              x.key === d.key ? { ...x, previewState: "error" } : x,
            ),
          );
        }
      });
    }
  };

  const removeDoc = (key: string) => {
    removed.current.add(key);
    const d = docs.find((x) => x.key === key);
    if (d?.preview) URL.revokeObjectURL(d.preview);
    setDocs((prev) => prev.filter((x) => x.key !== key));
  };

  const moveDoc = (key: string, delta: number) => {
    setDocs((prev) => {
      const i = prev.findIndex((x) => x.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const formErrors: string[] = [];
  if (!brand) formErrors.push("Wybierz lub wpisz markę.");
  if (!model) formErrors.push("Wybierz lub wpisz model.");
  if (!year) formErrors.push("Wybierz rocznik.");
  if (docs.length === 0) formErrors.push("Dodaj co najmniej jeden plik PDF.");
  if (docs.some((d) => !d.title.trim()))
    formErrors.push("Każdy dokument musi mieć tytuł.");

  /* ---- step 3: upload + polling */

  const submit = () => {
    setSubmitError(null);
    setJob(null);
    setUpload(0);
    setStep(3);
    const form = new FormData();
    form.set("brand", brand);
    form.set("model", model);
    form.set("year", year);
    if (variant.trim()) form.set("variant", variant.trim());
    for (const d of docs) {
      form.append("files", d.file, d.file.name);
      form.append("titles", d.title.trim());
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/cars");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUpload(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUpload(100);
      const body = xhr.response as { job?: Job; error?: string } | null;
      if (xhr.status === 202 && body?.job) setJob(body.job);
      else setSubmitError(body?.error ?? `Błąd serwera (HTTP ${xhr.status}).`);
    };
    xhr.onerror = () =>
      setSubmitError(
        "Nie udało się wysłać plików — czy serwer aplikacji działa?",
      );
    xhr.send(form);
  };

  const jobId = job?.id;
  const jobRunning = job?.state === "running";
  useEffect(() => {
    if (!jobId || !jobRunning) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const body = (await r.json()) as { job?: Job; error?: string };
        if (stop) return;
        if (!r.ok || !body.job) {
          setSubmitError(body.error ?? `HTTP ${r.status}`);
          return;
        }
        setJob(body.job);
        if (body.job.state !== "running") return;
      } catch {
        // Transient network error: try again.
      }
      if (!stop) timer = setTimeout(poll, 1000);
    };
    timer = setTimeout(poll, 600);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobId, jobRunning]);

  const jobState = job?.state;
  useEffect(() => {
    if (jobState !== "done") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- job finished
    setStep(4);
    // Reload server components so the new car appears in the header and lists.
    router.refresh();
  }, [jobState, router]);

  const resume = (id: string) => {
    setJob({
      id,
      carId: "",
      label: "",
      state: "running",
      pdfsDeleted: false,
      docs: [],
    });
    setUpload(100);
    setSubmitError(null);
    setStep(3);
  };

  const reset = () => {
    for (const d of docs) if (d.preview) URL.revokeObjectURL(d.preview);
    setDocs([]);
    setBrandChoice("");
    setBrandOther("");
    setModelChoice("");
    setModelOther("");
    setYear("");
    setVariant("");
    setJob(null);
    setUpload(null);
    setNotice([]);
    setStep(2);
    void check();
  };

  const ready =
    !!system &&
    system.pythonReady &&
    system.extractor &&
    system.database.writable &&
    !system.runningJob;

  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);

  /* ---- render */

  return (
    <div className="mt-6">
      <ol className="grid grid-cols-2 border border-line bg-white text-sm sm:grid-cols-4">
        {STEPS.map((s) => (
          <li
            key={s.n}
            aria-current={step === s.n ? "step" : undefined}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 ${
              step === s.n
                ? "silver-bar border-b-red font-semibold"
                : step > s.n
                  ? "border-b-graphite text-graphite"
                  : "border-b-transparent text-steel"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center border text-xs ${
                step === s.n
                  ? "border-red bg-red text-white"
                  : step > s.n
                    ? "border-graphite bg-graphite text-white"
                    : "border-silver"
              }`}
            >
              {step > s.n ? "✓" : s.n}
            </span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <StepRequirements
          system={system}
          error={systemError}
          checking={checking}
          ready={ready}
          onCheck={check}
          onResume={resume}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <section className="mt-6">
          <h2 className="sr-only">Auto i dokumenty</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="1. Marka" htmlFor="car-brand">
              <select
                id="car-brand"
                className="field"
                value={brandChoice}
                onChange={(e) => {
                  setBrandChoice(e.target.value);
                  setModelChoice("");
                  setModelOther("");
                }}
              >
                <option value="">— wybierz markę —</option>
                {CATALOG_BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
                <option value={OTHER}>Inna marka…</option>
              </select>
              {brandIsOther && (
                <input
                  className="field mt-1"
                  placeholder="Wpisz markę"
                  maxLength={60}
                  value={brandOther}
                  onChange={(e) => setBrandOther(e.target.value)}
                  aria-label="Własna marka"
                  autoFocus
                />
              )}
            </Field>
            <Field label="2. Model" htmlFor="car-model">
              {brandIsOther ? (
                <input
                  id="car-model"
                  className="field"
                  placeholder={brand ? "Wpisz model" : "najpierw podaj markę"}
                  maxLength={60}
                  value={modelOther}
                  disabled={!brand}
                  onChange={(e) => setModelOther(e.target.value)}
                />
              ) : (
                <>
                  <select
                    id="car-model"
                    className="field"
                    value={modelChoice}
                    disabled={!brand}
                    onChange={(e) => setModelChoice(e.target.value)}
                  >
                    <option value="">
                      {brand ? "— wybierz model —" : "najpierw wybierz markę"}
                    </option>
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value={OTHER}>Inny model…</option>
                  </select>
                  {modelChoice === OTHER && (
                    <input
                      className="field mt-1"
                      placeholder="Wpisz model"
                      maxLength={60}
                      value={modelOther}
                      onChange={(e) => setModelOther(e.target.value)}
                      aria-label="Własny model"
                      autoFocus
                    />
                  )}
                </>
              )}
            </Field>
            <Field label="3. Rocznik" htmlFor="car-year">
              <select
                id="car-year"
                className="field"
                value={year}
                disabled={!model}
                onChange={(e) => setYear(e.target.value)}
              >
                <option value="">
                  {model ? "— wybierz rocznik —" : "najpierw wybierz model"}
                </option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Wersja / silnik (opcjonalnie)"
            htmlFor="car-variant"
            className="mt-3"
          >
            <input
              id="car-variant"
              className="field"
              maxLength={120}
              placeholder="np. 1.6 Turbo 170 KM, automat"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
            />
          </Field>
          {duplicate && (
            <p className="mt-2 border-l-4 border-red bg-paper px-3 py-2 text-sm">
              W bazie jest już auto „{duplicate.label}”. Nowe dokumenty zostaną
              zapisane jako osobne auto (z dopiskiem w nazwie folderu).
            </p>
          )}

          <div
            className={`mt-5 border-2 border-dashed p-3 sm:p-4 ${
              dragging ? "border-red bg-paper" : "border-silver bg-white"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p>
                <strong>Dokumenty PDF</strong>{" "}
                <span className="text-steel">
                  ({docs.length}/{maxDocs}) — przeciągnij pliki tutaj albo
                </span>
              </p>
              <label
                className={`btn cursor-pointer ${
                  docs.length >= maxDocs ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Wybierz pliki
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="sr-only"
                  disabled={docs.length >= maxDocs}
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {notice.length > 0 && (
              <ul className="mt-2 text-xs text-red">
                {notice.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {docs.length === 0 ? (
              <p className="py-12 text-center text-sm text-steel">
                Upuść tutaj do {maxDocs} instrukcji w PDF (np. instrukcja
                obsługi, instrukcja multimediów, książka serwisowa).
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {docs.map((d, i) => (
                  <li
                    key={d.key}
                    className="flex flex-col border border-line bg-white"
                  >
                    <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden border-b border-line bg-paper">
                      {d.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local object URL
                        <img
                          src={d.preview}
                          alt={`Pierwsza strona: ${d.title}`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="px-2 text-center text-xs text-steel">
                          {d.previewState === "loading"
                            ? "Generowanie podglądu…"
                            : "PDF (brak podglądu)"}
                        </span>
                      )}
                      <span className="absolute top-0 left-0 bg-ink px-1.5 py-0.5 text-xs text-white">
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-2">
                      <input
                        className="field h-8 px-2 text-sm"
                        value={d.title}
                        maxLength={120}
                        aria-label={`Tytuł dokumentu ${i + 1}`}
                        onChange={(e) =>
                          setDocs((prev) =>
                            prev.map((x) =>
                              x.key === d.key
                                ? { ...x, title: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                      <p
                        className="truncate text-xs text-steel"
                        title={d.file.name}
                      >
                        {d.file.name}
                      </p>
                      <p className="text-xs text-graphite">
                        {d.pages != null ? `${d.pages} str. · ` : ""}
                        {formatSize(d.file.size)}
                      </p>
                      <div className="mt-auto flex gap-1 pt-1">
                        <button
                          type="button"
                          className="btn btn-ghost h-7 px-2 py-0"
                          disabled={i === 0}
                          onClick={() => moveDoc(d.key, -1)}
                          aria-label="Przesuń wcześniej"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost h-7 px-2 py-0"
                          disabled={i === docs.length - 1}
                          onClick={() => moveDoc(d.key, 1)}
                          aria-label="Przesuń dalej"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost ml-auto h-7 px-2 py-0 text-red"
                          onClick={() => removeDoc(d.key)}
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 border border-line bg-paper px-4 py-3 text-sm text-graphite">
            <p>
              Folder docelowy:{" "}
              <code className="text-ink">
                database/{targetId || "<marka-model-rocznik>"}/
              </code>
            </p>
            <p className="mt-1">
              Z każdego PDF powstanie osobna księga (tytuł z karty powyżej).
              Pliki PDF są używane tylko podczas przetwarzania i zostaną{" "}
              <strong>usunięte</strong> — zapisane zostaną wyłącznie pliki JSON
              i obrazy WebP.
            </p>
          </div>

          {formErrors.length > 0 && (
            <ul className="mt-3 text-xs text-steel">
              {formErrors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <button type="button" className="btn" onClick={() => setStep(1)}>
              ← Wymagania
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={formErrors.length > 0 || !ready}
              onClick={submit}
            >
              Zapisz auto i przetwórz
              {docs.length > 0 ? ` (${docs.length})` : ""}
            </button>
          </div>
          {!ready && (
            <p className="mt-2 text-right text-xs text-red">
              Środowisko nie jest gotowe — wróć do kroku „Wymagania”.
            </p>
          )}
        </section>
      )}

      {step === 3 && (
        <StepProcessing
          upload={upload}
          job={job}
          error={submitError}
          onBack={() => {
            setSubmitError(null);
            setJob(null);
            setUpload(null);
            setStep(docs.length ? 2 : 1);
            void check();
          }}
        />
      )}

      {step === 4 && job && (
        <StepDone
          job={job}
          onOpen={() => {
            setActiveCar(job.carId);
            router.push(carHref(job.carId));
          }}
          onAgain={reset}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ sub-views */

function Field({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label
        htmlFor={htmlFor}
        className="mb-1 text-xs font-semibold tracking-[0.08em] text-graphite uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Check({
  ok,
  label,
  children,
}: {
  ok: boolean;
  label: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3 border-b border-line px-4 py-2 last:border-b-0">
      <span
        aria-label={ok ? "spełnione" : "niespełnione"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center border text-xs text-white ${
          ok ? "border-graphite bg-graphite" : "border-red bg-red"
        }`}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className="min-w-0">
        <span className="font-semibold">{label}</span>
        {children && (
          <span className="block text-xs text-graphite">{children}</span>
        )}
      </span>
    </li>
  );
}

function Cmd({ children }: { children: string }) {
  return (
    <pre className="mt-1 overflow-x-auto border border-line bg-paper px-3 py-2 text-xs text-ink">
      <code>{children}</code>
    </pre>
  );
}

function StepRequirements({
  system,
  error,
  checking,
  ready,
  onCheck,
  onResume,
  onNext,
}: {
  system: SystemStatus | null;
  error: string | null;
  checking: boolean;
  ready: boolean;
  onCheck: () => void;
  onResume: (id: string) => void;
  onNext: () => void;
}) {
  const py = system?.python;
  const running = system?.runningJob;
  const isWindows = system?.platform === "win32";
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div>
        <div className="panel">
          <h2 className="panel-title flex items-center justify-between">
            Sprawdzenie środowiska
            <button
              type="button"
              className="btn h-7 py-0 normal-case"
              onClick={onCheck}
              disabled={checking}
            >
              {checking ? "Sprawdzanie…" : "Sprawdź ponownie"}
            </button>
          </h2>
          {error && (
            <p className="px-4 py-3 text-sm text-red">
              Nie udało się połączyć z serwerem aplikacji ({error}). Kreator
              działa tylko przy uruchomionym serwerze (<code>npm run dev</code>{" "}
              lub <code>npm start</code>).
            </p>
          )}
          {!system && !error && (
            <p className="px-4 py-3 text-sm text-steel">Sprawdzanie…</p>
          )}
          {system && (
            <ul className="text-sm">
              <Check ok label="Serwer aplikacji (Node.js)">
                {system.node} — działa lokalnie na tym komputerze.
              </Check>
              <Check ok={!!py} label="Python 3">
                {py
                  ? `${py.version} (${py.command})`
                  : "Nie znaleziono interpretera Pythona 3."}
              </Check>
              <Check ok={!!py?.pymupdf} label="Biblioteka PyMuPDF (odczyt PDF)">
                {py?.pymupdf
                  ? `wersja ${py.pymupdf}`
                  : "Brak — zainstaluj (polecenia obok)."}
              </Check>
              <Check ok={!!py?.pillow} label="Biblioteka Pillow (obrazy WebP)">
                {py?.pillow
                  ? `wersja ${py.pillow}`
                  : "Brak — zainstaluj (polecenia obok)."}
              </Check>
              <Check ok={system.extractor} label="Skrypt scripts/extract.py">
                {system.extractor
                  ? "Na miejscu."
                  : "Brak pliku — pobierz pełne repozytorium."}
              </Check>
              <Check
                ok={system.database.writable}
                label={`Zapis do folderu ${system.database.path}/`}
              >
                {system.database.writable
                  ? "Folder bazy jest zapisywalny."
                  : "Brak uprawnień do zapisu w folderze bazy."}
              </Check>
              <Check ok={!running} label="Brak trwającego importu">
                {running ? (
                  <>
                    Trwa przetwarzanie: {running.label || "nowe auto"}.{" "}
                    {running.id && (
                      <button
                        type="button"
                        className="font-semibold text-red underline"
                        onClick={() => onResume(running.id)}
                      >
                        Pokaż postęp
                      </button>
                    )}
                  </>
                ) : (
                  "Można zacząć."
                )}
              </Check>
            </ul>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!ready}
            onClick={onNext}
          >
            Dalej: auto i dokumenty →
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 text-sm">
        <div className="panel">
          <h2 className="panel-title">Jak to działa — krok po kroku</h2>
          <ol className="flex list-decimal flex-col gap-2 py-3 pr-4 pl-8 text-graphite">
            <li>
              <strong className="text-ink">Wymagania</strong> — serwer sprawdza,
              czy ma Pythona z bibliotekami do odczytu PDF.
            </li>
            <li>
              <strong className="text-ink">Auto i dokumenty</strong> — wybierasz
              markę, model i rocznik, a potem dodajesz do{" "}
              {system?.limits.maxDocuments ?? 10} plików PDF z instrukcjami (z
              podglądem pierwszej strony).
            </li>
            <li>
              <strong className="text-ink">Przetwarzanie</strong> — lokalny
              serwer wyodrębnia tekst, rozdziały, ostrzeżenia, tabele i
              ilustracje. Nic nie jest wysyłane do internetu.
            </li>
            <li>
              <strong className="text-ink">Gotowe</strong> — w folderze{" "}
              <code>database/&lt;auto&gt;/</code> powstają pliki JSON i obrazy
              WebP, a pliki PDF są usuwane.
            </li>
          </ol>
          <p className="border-t border-line px-4 py-2 text-xs text-steel">
            Folder <code>database/</code> jest częścią repozytorium — po
            zatwierdzeniu go w git auto będzie dostępne na każdym urządzeniu, na
            którym uruchomisz aplikację, bez ponownego wgrywania PDF.
          </p>
        </div>
        {system && !system.pythonReady && (
          <div className="panel">
            <h2 className="panel-title">Instalacja wymagań</h2>
            <div className="p-4">
              <p className="text-graphite">
                W katalogu projektu utwórz środowisko <code>.venv</code> (serwer
                wykryje je automatycznie), a potem kliknij „Sprawdź ponownie”:
              </p>
              {isWindows ? (
                <Cmd>
                  {
                    "py -3 -m venv .venv\n.venv\\Scripts\\python -m pip install -r scripts\\requirements.txt"
                  }
                </Cmd>
              ) : (
                <Cmd>
                  {
                    "python3 -m venv .venv\n.venv/bin/python -m pip install -r scripts/requirements.txt"
                  }
                </Cmd>
              )}
              <p className="mt-2 text-xs text-steel">
                Inny interpreter wskażesz zmienną środowiskową{" "}
                <code>PYTHON</code> przy uruchamianiu serwera.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const DOC_STATE: Record<JobDoc["state"], string> = {
  queued: "W kolejce",
  running: "Przetwarzanie…",
  done: "Gotowe",
  error: "Błąd",
};

function StepProcessing({
  upload,
  job,
  error,
  onBack,
}: {
  upload: number | null;
  job: Job | null;
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
          {job?.label
            ? `Przetwarzanie: ${job.label}`
            : "Wysyłanie plików na lokalny serwer"}
        </h2>
        <div className="p-4 text-sm">
          <Progress
            label={
              uploading
                ? `Wysyłanie plików: ${upload ?? 0}%`
                : `Dokumenty: ${done}/${total}`
            }
            value={uploading ? (upload ?? 0) : total ? (done / total) * 100 : 0}
          />
          {uploading && upload === 100 && (
            <p className="mt-2 text-steel">Zapisywanie plików tymczasowych…</p>
          )}
          {job?.state === "running" && !error && (
            <p className="mt-2 text-graphite">
              Nie zatrzymuj serwera. Możesz zamknąć tę kartę — postęp zobaczysz
              po powrocie do kreatora (krok „Wymagania” → „Pokaż postęp”).
            </p>
          )}
          {failed && (
            <div className="mt-3 border-l-4 border-red bg-paper px-3 py-2">
              <p className="font-semibold text-red">Import nie powiódł się</p>
              <p className="mt-1">{error ?? job?.error}</p>
              {job?.pdfsDeleted && (
                <p className="mt-1 text-xs text-graphite">
                  Tymczasowe pliki PDF zostały usunięte; w bazie nic nie
                  zapisano.
                </p>
              )}
              <button type="button" className="btn mt-2" onClick={onBack}>
                ← Wróć i spróbuj ponownie
              </button>
            </div>
          )}
        </div>
      </div>
      {job && job.docs.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {job.docs.map((d) => (
            <li key={d.bookId} className="border border-line bg-white">
              <div
                className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${
                  d.state === "error"
                    ? "border-b-red"
                    : d.state === "running"
                      ? "silver-bar border-b-line"
                      : "border-b-line"
                }`}
              >
                <span className="truncate font-semibold" title={d.title}>
                  {d.title}
                </span>
                <span
                  className={`badge ${
                    d.state === "error"
                      ? "badge-red"
                      : d.state === "done"
                        ? "badge-dark"
                        : ""
                  }`}
                >
                  {DOC_STATE[d.state]}
                </span>
              </div>
              <div className="px-3 py-2 text-xs text-graphite">
                <p>
                  {d.name} · {formatSize(d.size)}
                  {d.pages != null ? ` · ${d.pages} str.` : ""}
                </p>
                {d.state === "done" && (
                  <p className="mt-1">
                    Sekcje: <strong>{d.sections ?? "?"}</strong> · obrazy:{" "}
                    <strong>{d.images ?? "?"}</strong>
                  </p>
                )}
                {d.error && <p className="mt-1 text-red">{d.error}</p>}
                {d.log.length > 0 && d.state !== "done" && (
                  <pre className="mt-1 max-h-24 overflow-auto bg-paper px-2 py-1 text-[11px] whitespace-pre-wrap">
                    {d.log.slice(-4).join("\n")}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="mb-1 text-graphite">{label}</p>
      <div
        className="h-2 border border-line bg-paper"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-red transition-[width]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function StepDone({
  job,
  onOpen,
  onAgain,
}: {
  job: Job;
  onOpen: () => void;
  onAgain: () => void;
}) {
  const dir = `database/${job.carId}`;
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="panel">
        <h2 className="panel-title">Zapisano: {job.label}</h2>
        <div className="p-4 text-sm">
          <ul className="border-t border-line">
            {job.docs.map((d) => (
              <li
                key={d.bookId}
                className="flex flex-wrap justify-between gap-2 border-b border-line py-2"
              >
                <span className="font-semibold">{d.title}</span>
                <span className="text-graphite">
                  {d.pages ?? "?"} str. · {d.sections ?? "?"} sekcji ·{" "}
                  {d.images ?? "?"} obrazów
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Treść zapisano w <code>{dir}/</code>.{" "}
            {job.pdfsDeleted
              ? "Przesłane pliki PDF zostały usunięte."
              : "Uwaga: nie udało się potwierdzić usunięcia plików PDF."}
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
        <h2 className="panel-title">Na innych urządzeniach</h2>
        <div className="p-4">
          <p className="text-graphite">
            Zatwierdź nowy folder w repozytorium, a potem pobierz zmiany na
            innym komputerze — auto będzie od razu dostępne:
          </p>
          <Cmd>{`git add ${dir}\ngit commit -m "Add ${job.label.replace(/["`$\\]/g, "")}"\ngit push`}</Cmd>
          <p className="mt-2 text-xs text-steel">
            Na drugim urządzeniu: <code>git pull</code>, a następnie{" "}
            <code>npm run dev</code> lub <code>npm run build</code> i{" "}
            <code>npm start</code>.
          </p>
        </div>
      </div>
    </section>
  );
}
