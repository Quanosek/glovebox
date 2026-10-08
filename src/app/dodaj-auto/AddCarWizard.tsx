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
import { EquipmentEditor } from "@/components/EquipmentEditor";
import { suggestFromSpec } from "@/config/vehicle";
import type {
  CarSpec,
  CatalogBrand,
  CatalogEngine,
  CatalogModel,
} from "@/lib/catalog";
import { carHref, type CarFeatureSections, type CarSummary } from "@/lib/cars";
import { useOnline } from "@/lib/offline";
import { renderPdfPreview } from "@/lib/pdfPreview";
import { slugify } from "@/lib/slug";
import { getStore } from "@/lib/storage/store";
import { setActiveCar, setVehicleProfile } from "@/lib/storage/hooks";
import { plural } from "@/lib/typography";

/* ------------------------------------------------------------------ types */

interface SystemStatus {
  node: string;
  nodeReady: boolean;
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
  manuals: { count: number };
  limits: { maxDocuments: number; maxFileBytes: number };
  localAccess: boolean;
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

const STEPS: { n: Step; label: string; hint: string }[] = [
  {
    n: 1,
    label: "Auto i instrukcje",
    hint: "marka, model, rocznik i pliki PDF",
  },
  { n: 2, label: "Odczytywanie", hint: "aplikacja czyta instrukcje" },
  { n: 3, label: "Wyposażenie", hint: "co ma Twoje auto" },
  { n: 4, label: "Gotowe", hint: "auto pojawia się na liście" },
];

const OTHER = "__other__";

const BRAND_GROUPS: {
  label: string;
  filter: (b: CatalogBrand) => boolean;
}[] = [
  { label: "Popularne marki", filter: (b) => b.popular && !b.usOnly },
  { label: "Pozostałe marki", filter: (b) => !b.popular && !b.usOnly },
  { label: "Marki z rynku amerykańskiego", filter: (b) => b.usOnly },
];

/** Lists from the official catalogue, loaded on demand. */
type Loadable<T> =
  | { state: "loading" }
  | { state: "done"; items: T[] }
  | { state: "error"; error: string };

async function fetchList<T>(url: string, key: string): Promise<T[]> {
  let r: Response;
  try {
    r = await fetch(url);
  } catch {
    throw new Error("Brak połączenia z aplikacją. Spróbuj ponownie za chwilę.");
  }
  const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok || !Array.isArray(body[key]))
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : "Nie udało się wczytać listy aut.",
    );
  return body[key] as T[];
}

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
  const online = useOnline();

  // Step 1 form. Brand, model and year come from the official catalogue;
  // "Inna" lets the owner type them (all still required).
  const [brands, setBrands] = useState<Loadable<CatalogBrand>>({
    state: "loading",
  });
  const [models, setModels] = useState<Loadable<CatalogModel> | null>(null);
  const [engines, setEngines] = useState<Loadable<CatalogEngine> | null>(null);
  const [brandChoice, setBrandChoice] = useState("");
  const [brandOther, setBrandOther] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [modelOther, setModelOther] = useState("");
  const [year, setYear] = useState("");
  const [engineChoice, setEngineChoice] = useState("");
  const [variant, setVariant] = useState("");
  const request = useRef(0);
  const [docs, setDocs] = useState<PickedDoc[]>([]);
  const [notice, setNotice] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  // Steps 2–4.
  const [upload, setUpload] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<
    | { state: "loading" }
    | { state: "done"; sections: CarFeatureSections; spec?: CarSpec }
    | { state: "error" }
    | null
  >(null);

  const maxDocs = system?.limits.maxDocuments ?? 10;
  const maxBytes = system?.limits.maxFileBytes ?? 250 * 1024 * 1024;

  const brandIsOther = brandChoice === OTHER;
  const brandList = brands.state === "done" ? brands.items : [];
  const modelList = models?.state === "done" ? models.items : [];
  const engineList = engines?.state === "done" ? engines.items : [];
  const catalogModel = modelList.find((m) => m.id === modelChoice);
  const brand = brandIsOther
    ? brandOther.trim()
    : (brandList.find((b) => b.id === brandChoice)?.name ?? "");
  const model = brandIsOther ? modelOther.trim() : (catalogModel?.name ?? "");
  const engine = engineList.find((e) => e.id === engineChoice);
  const duplicate =
    brand && model && year
      ? cars.find(
          (c) =>
            slugify(c.brand) === slugify(brand) &&
            slugify(c.model) === slugify(model) &&
            String(c.year) === year,
        )
      : undefined;

  /* ---- background check: can this app read PDFs right now? */

  const check = useCallback(async () => {
    setChecking(true);
    setSystemError(null);
    try {
      const r = await fetch("/api/system", { cache: "no-store" });
      if (!r.ok) throw new Error("Nie udało się sprawdzić gotowości.");
      setSystem((await r.json()) as SystemStatus);
    } catch {
      setSystem(null);
      setSystemError("Nie udało się sprawdzić, czy można teraz dodać auto.");
    } finally {
      setChecking(false);
    }
  }, []);

  const loadBrands = useCallback(async () => {
    setBrands({ state: "loading" });
    try {
      setBrands({
        state: "done",
        items: await fetchList<CatalogBrand>("/api/catalog/brands", "brands"),
      });
    } catch (err) {
      setBrands({ state: "error", error: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void check();
    void loadBrands();
  }, [check, loadBrands]);

  /* ---- step 1: car from the catalogue */

  const chooseBrand = async (id: string) => {
    const ticket = ++request.current;
    setBrandChoice(id);
    setModelChoice("");
    setModelOther("");
    setYear("");
    setEngineChoice("");
    setEngines(null);
    setVariant("");
    if (!id || id === OTHER) {
      setModels(null);
      return;
    }
    setModels({ state: "loading" });
    try {
      const items = await fetchList<CatalogModel>(
        `/api/catalog/models?brand=${encodeURIComponent(id)}`,
        "models",
      );
      if (ticket === request.current) setModels({ state: "done", items });
    } catch (err) {
      if (ticket === request.current)
        setModels({ state: "error", error: (err as Error).message });
    }
  };

  const chooseModel = (id: string) => {
    ++request.current;
    setModelChoice(id);
    setYear("");
    setEngineChoice("");
    setEngines(null);
  };

  const chooseYear = async (value: string) => {
    const ticket = ++request.current;
    setYear(value);
    setEngineChoice("");
    if (brandIsOther || !value || !modelChoice) {
      setEngines(null);
      return;
    }
    setEngines({ state: "loading" });
    try {
      const items = await fetchList<CatalogEngine>(
        `/api/catalog/engines?brand=${encodeURIComponent(brandChoice)}&model=${encodeURIComponent(modelChoice)}&year=${value}`,
        "engines",
      );
      if (ticket === request.current) setEngines({ state: "done", items });
    } catch (err) {
      if (ticket === request.current)
        setEngines({ state: "error", error: (err as Error).message });
    }
  };

  /* ---- step 1: documents */

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
        messages.push(`Pominięto „${file.name}” – to nie jest plik PDF.`);
      } else if (known.has(key)) {
        messages.push(
          `Pominięto „${file.name}” – ten plik jest już na liście.`,
        );
      } else if (file.size > maxBytes) {
        messages.push(
          `Pominięto „${file.name}” – plik jest większy niż ${formatSize(maxBytes)}.`,
        );
      } else if (docs.length + next.length >= maxDocs) {
        messages.push(
          `Pominięto „${file.name}” – jedno auto może mieć najwyżej ${maxDocs} ${plural(maxDocs, "plik", "pliki", "plików")}.`,
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
  if (!brand) formErrors.push("Wybierz markę z listy albo „Inna” i wpisz ją.");
  if (!model) formErrors.push("Wybierz lub wpisz model.");
  if (!year) formErrors.push("Wybierz rocznik.");
  if (!brandIsOther && engines?.state === "loading")
    formErrors.push("Poczekaj na listę silników.");
  if (docs.length === 0) formErrors.push("Dodaj co najmniej jeden plik PDF.");
  if (docs.some((d) => !d.title.trim()))
    formErrors.push("Każda instrukcja musi mieć nazwę.");

  /* ---- step 2: upload + polling */

  const submit = () => {
    setSubmitError(null);
    setJob(null);
    setUpload(0);
    setStep(2);
    const form = new FormData();
    form.set("source", brandIsOther ? "other" : "catalog");
    form.set("brand", brandIsOther ? brand : brandChoice);
    form.set("model", brandIsOther ? model : modelChoice);
    form.set("year", year);
    if (!brandIsOther && engine) form.set("engine", engine.id);
    if (brandIsOther && variant.trim()) form.set("variant", variant.trim());
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
      else
        setSubmitError(
          body?.error ??
            "Nie udało się rozpocząć dodawania auta. Spróbuj ponownie za chwilę.",
        );
    };
    xhr.onerror = () =>
      setSubmitError(
        "Nie udało się wysłać plików. Sprawdź połączenie i spróbuj ponownie.",
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
          setSubmitError(
            body.error ?? "Nie udało się sprawdzić postępu dodawania auta.",
          );
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

  /* ---- step 3: equipment described in the new manuals */

  const loadEquipment = useCallback(async (carId: string) => {
    setEquipment({ state: "loading" });
    try {
      const r = await fetch(`/api/cars/${carId}/features`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error();
      const body = (await r.json()) as {
        sections: CarFeatureSections;
        spec: CarSpec | null;
      };
      const spec = body.spec ?? undefined;
      // Pre-fill what the engine tells for sure (shown as suggestions).
      if (!getStore().get().settings.vehicles[carId]) {
        const suggested = Object.entries(suggestFromSpec(spec)).filter(
          ([id]) => body.sections[id]?.length,
        );
        if (suggested.length > 0)
          setVehicleProfile(carId, Object.fromEntries(suggested));
      }
      setEquipment({ state: "done", sections: body.sections, spec });
    } catch {
      setEquipment({ state: "error" });
    }
  }, []);

  const jobState = job?.state;
  const jobCar = job?.carId;
  useEffect(() => {
    if (jobState !== "done" || !jobCar) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- job finished
    setStep(3);
    void loadEquipment(jobCar);
    // Reload server components so the new car appears in the header and lists.
    router.refresh();
  }, [jobState, jobCar, router, loadEquipment]);

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
    setStep(2);
  };

  const reset = () => {
    for (const d of docs) if (d.preview) URL.revokeObjectURL(d.preview);
    setDocs([]);
    void chooseBrand("");
    setBrandOther("");
    setJob(null);
    setEquipment(null);
    setUpload(null);
    setNotice([]);
    setStep(1);
    void check();
  };

  const ready =
    online &&
    !!system &&
    system.pythonReady &&
    system.extractor &&
    system.database.writable &&
    system.localAccess &&
    !system.runningJob;

  const years: number[] = [];
  if (brandIsOther) for (let y = maxYear; y >= minYear; y--) years.push(y);
  else if (catalogModel) years.push(...[...catalogModel.years].reverse());

  /* ---- render */

  return (
    <div className="mt-6">
      <ol className="grid border border-line bg-white text-sm sm:grid-cols-2 lg:grid-cols-4">
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
            <span className="min-w-0">
              <span className="block">{s.label}</span>
              <span className="block text-xs font-normal text-steel">
                {s.hint}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Availability
          online={online}
          system={system}
          error={systemError}
          checking={checking}
          onCheck={check}
          onResume={resume}
        />
      )}

      {step === 1 && (
        <section className="mt-6">
          <h2 className="sr-only">Auto i instrukcje</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="1. Marka" htmlFor="car-brand">
              <select
                id="car-brand"
                className="field"
                value={brandChoice}
                onChange={(e) => void chooseBrand(e.target.value)}
              >
                <option value="">
                  {brands.state === "loading"
                    ? "Wczytywanie listy marek…"
                    : "Wybierz markę"}
                </option>
                {BRAND_GROUPS.map((g) => {
                  const list = brandList.filter(g.filter);
                  return list.length === 0 ? null : (
                    <optgroup key={g.label} label={g.label}>
                      {list.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
                <option value={OTHER}>Inna (wpiszę ręcznie)</option>
              </select>
              {brandIsOther && (
                <input
                  className="field mt-1"
                  placeholder="Wpisz markę"
                  maxLength={60}
                  value={brandOther}
                  onChange={(e) => setBrandOther(e.target.value)}
                  aria-label="Marka wpisana ręcznie"
                  autoFocus
                />
              )}
            </Field>
            <Field label="2. Model" htmlFor="car-model">
              {brandIsOther ? (
                <input
                  id="car-model"
                  className="field"
                  placeholder={brand ? "Wpisz model" : "najpierw wpisz markę"}
                  maxLength={60}
                  value={modelOther}
                  disabled={!brand}
                  onChange={(e) => setModelOther(e.target.value)}
                />
              ) : (
                <select
                  id="car-model"
                  className="field"
                  value={modelChoice}
                  disabled={models?.state !== "done"}
                  onChange={(e) => chooseModel(e.target.value)}
                >
                  <option value="">
                    {!brandChoice
                      ? "najpierw wybierz markę"
                      : models?.state === "loading"
                        ? "Wczytywanie modeli…"
                        : models?.state === "error"
                          ? "Nie udało się wczytać"
                          : "Wybierz model"}
                  </option>
                  {modelList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="3. Rocznik" htmlFor="car-year">
              <select
                id="car-year"
                className="field"
                value={year}
                disabled={!model}
                onChange={(e) => void chooseYear(e.target.value)}
              >
                <option value="">
                  {model ? "Wybierz rocznik" : "najpierw wybierz model"}
                </option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            {brandIsOther ? (
              <Field label="4. Wersja (opcjonalnie)" htmlFor="car-variant">
                <input
                  id="car-variant"
                  className="field"
                  maxLength={120}
                  placeholder="np. 1.6 Turbo 170 KM, automat"
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="4. Silnik (opcjonalnie)" htmlFor="car-engine">
                <select
                  id="car-engine"
                  className="field"
                  value={engineChoice}
                  disabled={engines?.state !== "done"}
                  onChange={(e) => setEngineChoice(e.target.value)}
                >
                  <option value="">
                    {!year
                      ? "najpierw wybierz rocznik"
                      : engines?.state === "loading"
                        ? "Wczytywanie silników…"
                        : engines?.state === "error"
                          ? "Nie udało się wczytać"
                          : engineList.length === 0
                            ? "Brak danych – pomiń"
                            : "Nie wiem / pomiń"}
                  </option>
                  {engineList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          {brands.state === "error" && !brandIsOther && (
            <div
              role="status"
              className="mt-2 flex flex-col gap-2 border-l-4 border-red bg-paper px-3 py-2 text-sm sm:flex-row sm:items-center"
            >
              <p className="flex-1">{brands.error}</p>
              <button
                type="button"
                className="btn shrink-0"
                onClick={() => void loadBrands()}
              >
                Spróbuj ponownie
              </button>
            </div>
          )}
          {models?.state === "error" && (
            <p className="mt-2 border-l-4 border-red bg-paper px-3 py-2 text-sm">
              {models.error}
            </p>
          )}
          <p className="mt-2 text-xs text-steel">
            {brandIsOther
              ? "Wpisz markę i model oraz wybierz rocznik – wszystkie trzy są wymagane."
              : "Marki, modele i roczniki pochodzą z oficjalnych rejestrów aut sprzedanych w Unii Europejskiej i w USA. Jeśli Twojego auta nie ma na liście, wybierz markę „Inna”."}
          </p>
          {duplicate && (
            <p className="mt-2 border-l-4 border-red bg-paper px-3 py-2 text-sm">
              Auto „{duplicate.label}” jest już na liście. Nowe instrukcje
              zostaną dodane jako osobne auto.
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
                <strong>Instrukcje w PDF</strong>{" "}
                <span className="text-steel">
                  ({docs.length} z {maxDocs}) – przeciągnij pliki tutaj albo
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
                Upuść tutaj do {maxDocs} plików PDF (np. instrukcja obsługi,
                instrukcja radia i nawigacji, książka serwisowa).
              </p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {docs.map((d, i) => (
                  <li
                    key={d.key}
                    className="flex flex-col border border-line bg-white"
                  >
                    <div className="relative flex aspect-3/4 items-center justify-center overflow-hidden border-b border-line bg-paper">
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
                            : "Brak podglądu"}
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
                        aria-label={`Nazwa instrukcji ${i + 1}`}
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

          <p className="mt-4 border border-line bg-paper px-4 py-3 text-sm text-graphite">
            Każdy plik stanie się osobną instrukcją o nazwie wpisanej na karcie.
            Pliki PDF są potrzebne tylko na czas odczytywania – potem aplikacja
            je <strong className="text-ink">usuwa</strong>, a instrukcje zostają
            już na stałe.
          </p>

          {formErrors.length > 0 && (
            <ul className="mt-3 text-xs text-steel">
              {formErrors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={formErrors.length > 0 || !ready}
              onClick={submit}
            >
              Dodaj auto
              {docs.length > 0
                ? ` i ${docs.length} ${plural(docs.length, "instrukcję", "instrukcje", "instrukcji")}`
                : ""}{" "}
              →
            </button>
          </div>
          {!ready && formErrors.length === 0 && (
            <p className="mt-2 text-right text-xs text-red">
              Dodawanie jest teraz niedostępne – zobacz komunikat na górze.
            </p>
          )}
        </section>
      )}

      {step === 2 && (
        <StepProcessing
          upload={upload}
          job={job}
          error={submitError}
          onBack={() => {
            setSubmitError(null);
            setJob(null);
            setUpload(null);
            setStep(1);
            void check();
          }}
        />
      )}

      {step === 3 && job && (
        <StepEquipment
          job={job}
          equipment={equipment}
          onRetry={() => void loadEquipment(job.carId)}
          onNext={() => setStep(4)}
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

/**
 * Plain-language status shown above the form when cars cannot be added right
 * now (no connection, another import running, PDF reader not installed …).
 * Technical details are deliberately left to the README.
 */
function Availability({
  online,
  system,
  error,
  checking,
  onCheck,
  onResume,
}: {
  online: boolean;
  system: SystemStatus | null;
  error: string | null;
  checking: boolean;
  onCheck: () => void;
  onResume: (id: string) => void;
}) {
  let title: string;
  let text: ReactNode;
  let action: ReactNode = (
    <button type="button" className="btn" onClick={onCheck} disabled={checking}>
      {checking ? "Sprawdzanie…" : "Sprawdź ponownie"}
    </button>
  );
  const running = system?.runningJob;
  if (!online || error) {
    title = "Brak połączenia";
    text =
      "Dodawanie instrukcji wymaga połączenia z aplikacją. Zapisane auta możesz dalej czytać – wróć tutaj, gdy połączenie wróci.";
  } else if (!system) {
    return checking ? (
      <p className="mt-4 text-sm text-steel">Sprawdzanie gotowości…</p>
    ) : null;
  } else if (running) {
    title = "Trwa dodawanie innego auta";
    text = `Aplikacja odczytuje właśnie instrukcje auta ${running.label || "dodanego przed chwilą"}. Nowe auto dodasz, gdy to się zakończy.`;
    action = (
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => onResume(running.id)}
      >
        Pokaż postęp
      </button>
    );
  } else if (!system.localAccess) {
    title = "Dodawanie tylko na komputerze z aplikacją";
    text =
      "Ze względów bezpieczeństwa nowe auta można dodawać wyłącznie na komputerze, na którym działa aplikacja. Czytanie instrukcji działa na wszystkich urządzeniach.";
  } else if (
    !system.nodeReady ||
    !system.pythonReady ||
    !system.extractor ||
    !system.database.writable
  ) {
    title = "Ten komputer nie jest jeszcze gotowy";
    text = (
      <>
        Aplikacja nie potrafi tu jeszcze odczytywać plików PDF. Poproś osobę,
        która ją uruchomiła, o jednorazowe przygotowanie – opis znajdzie w
        instrukcji aplikacji (plik README, rozdział „Dodawanie aut”).
      </>
    );
  } else {
    return system.manuals.count === 0 ? (
      <p className="mt-4 border-l-4 border-graphite bg-paper px-4 py-3 text-sm text-graphite">
        Nie ma tu jeszcze instrukcji. Dodaj pierwsze auto, aby rozpocząć
        korzystanie z biblioteki.
      </p>
    ) : null;
  }
  return (
    <div
      role="status"
      className="mt-4 flex flex-col gap-3 border-l-4 border-red bg-paper px-4 py-3 text-sm sm:flex-row sm:items-center"
    >
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-graphite">{text}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

const DOC_STATE: Record<JobDoc["state"], string> = {
  queued: "Czeka",
  running: "Odczytywanie…",
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
                    Rozdziały i podrozdziały:{" "}
                    <strong>{d.sections ?? "?"}</strong> · ilustracje:{" "}
                    <strong>{d.images ?? "?"}</strong>
                  </p>
                )}
                {d.error && (
                  <p className="mt-1 text-red">
                    Nie udało się odczytać tego pliku.
                  </p>
                )}
                {d.state === "error" && (d.error || d.log.length > 0) && (
                  <details className="mt-1">
                    <summary className="text-steel">
                      Szczegóły (dla osoby technicznej)
                    </summary>
                    <pre className="mt-1 max-h-24 overflow-auto bg-paper px-2 py-1 text-[11px] whitespace-pre-wrap">
                      {[d.error, ...d.log.slice(-4)].filter(Boolean).join("\n")}
                    </pre>
                  </details>
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

function StepEquipment({
  job,
  equipment,
  onRetry,
  onNext,
}: {
  job: Job;
  equipment:
    | { state: "loading" }
    | { state: "done"; sections: CarFeatureSections; spec?: CarSpec }
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
          {equipment?.state === "done" && equipment.spec && (
            <p>
              Silnik:{" "}
              <strong className="text-ink">{equipment.spec.label}</strong>. Na
              tej podstawie część pozycji jest już podpowiedziana – możesz je
              zmienić.
            </p>
          )}
          <p className="text-xs text-steel">
            Wszystko zmienisz później na stronie „Wyposażenie” tego auta.
          </p>
        </div>
      </div>
      {(!equipment || equipment.state === "loading") && (
        <p className="text-sm text-steel">
          Wyszukiwanie wyposażenia w instrukcjach…
        </p>
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
          spec={equipment.spec}
          sections={equipment.sections}
        />
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Dalej →
        </button>
      </div>
    </section>
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
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="panel">
        <h2 className="panel-title">Dodano: {job.label}</h2>
        <div className="p-4 text-sm">
          <ul className="border-t border-line">
            {job.docs.map((d) => (
              <li
                key={d.bookId}
                className="flex flex-wrap justify-between gap-2 border-b border-line py-2"
              >
                <span className="font-semibold">{d.title}</span>
                <span className="text-graphite">
                  {d.pages ?? "?"}{" "}
                  {d.pages == null
                    ? "str."
                    : plural(d.pages, "strona", "strony", "stron")}{" "}
                  · {d.sections ?? "?"}{" "}
                  {d.sections == null
                    ? "rozdziałów"
                    : plural(
                        d.sections,
                        "rozdział",
                        "rozdziały",
                        "rozdziałów",
                      )}{" "}
                  · {d.images ?? "?"}{" "}
                  {d.images == null
                    ? "ilustracji"
                    : plural(
                        d.images,
                        "ilustracja",
                        "ilustracje",
                        "ilustracji",
                      )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Instrukcje są gotowe do czytania.{" "}
            {job.pdfsDeleted
              ? "Przesłane pliki PDF zostały usunięte – nie są już potrzebne."
              : "Uwaga: nie udało się potwierdzić usunięcia przesłanych plików PDF."}
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
            Auto jest już na liście aut – widać je na każdym urządzeniu, które
            korzysta z aplikacji uruchomionej na tym komputerze.
          </li>
          <li>
            Wyposażenie auta zmienisz w każdej chwili na stronie „Wyposażenie”.
          </li>
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
