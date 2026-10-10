"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Skeleton } from "@/components/Skeleton";
import type { CarSpec, CatalogBrand, CatalogModel } from "@/lib/catalog";
import { carHref, type CarFeatureSections, type CarSummary } from "@/lib/cars";
import { documentTitle, formatFileSize } from "@/lib/files";
import { useOnline } from "@/lib/offline";
import { renderPdfPreview } from "@/lib/pdfPreview";
import { slugify } from "@/lib/slug";
import { addOwnedCar, setActiveCar } from "@/lib/storage/hooks";
import { plural } from "@/lib/typography";
import { Availability } from "./Availability";
import { StepDone, StepEquipment, StepProcessing } from "./ImportSteps";
import { DropIcon, Field, PanelHeading, WizardSteps } from "./WizardChrome";
import {
  BRAND_GROUPS,
  OTHER,
  fetchList,
  type Job,
  type Loadable,
  type PickedDoc,
  type Step,
  type SystemStatus,
} from "./wizardModel";

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
  const [brandChoice, setBrandChoice] = useState("");
  const [brandOther, setBrandOther] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [modelOther, setModelOther] = useState("");
  const [year, setYear] = useState("");
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
    | {
        state: "done";
        sections: CarFeatureSections;
        engines: CarSpec[];
        catalog?: { brand: string; model: string };
        year: number;
      }
    | { state: "error" }
    | null
  >(null);

  const maxDocs = system?.limits.maxDocuments ?? 10;
  const maxBytes = system?.limits.maxFileBytes ?? 250 * 1024 * 1024;

  const brandIsOther = brandChoice === OTHER;
  const brandList = brands.state === "done" ? brands.items : [];
  const modelList = models?.state === "done" ? models.items : [];
  const catalogModel = modelList.find((m) => m.id === modelChoice);
  const brand = brandIsOther
    ? brandOther.trim()
    : (brandList.find((b) => b.id === brandChoice)?.name ?? "");
  const model = brandIsOther ? modelOther.trim() : (catalogModel?.name ?? "");
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
  };

  const chooseYear = (value: string) => setYear(value);

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
          `Pominięto „${file.name}” – plik jest większy niż ${formatFileSize(maxBytes)}.`,
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
          title: documentTitle(file.name),
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
      if (xhr.status === 202 && body?.job) {
        setJob(body.job);
      } else
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
        engines: CarSpec[];
        catalog?: { brand: string; model: string };
        year: number;
      };
      setEquipment({ state: "done", ...body });
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
    addOwnedCar(jobCar);
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
      <WizardSteps step={step} />

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
        <section className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <h2 className="sr-only">Auto i instrukcje</h2>
          <div className="flex min-w-0 flex-col gap-6">
            <div className="panel">
              <PanelHeading
                mark="A"
                title="Twoje auto"
                hint="Marka, model i rocznik"
              />
              <div className="p-4 sm:p-5">
                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <Field label="Marka" htmlFor="car-brand">
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
                  <Field label="Model" htmlFor="car-model">
                    {brandIsOther ? (
                      <input
                        id="car-model"
                        className="field"
                        placeholder={
                          brand ? "Wpisz model" : "najpierw wpisz markę"
                        }
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
                  <Field label="Rocznik" htmlFor="car-year">
                    <select
                      id="car-year"
                      className="field"
                      value={year}
                      disabled={!model}
                      onChange={(e) => chooseYear(e.target.value)}
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
                  {brandIsOther && (
                    <Field label="Wersja (opcjonalnie)" htmlFor="car-variant">
                      <input
                        id="car-variant"
                        className="field"
                        maxLength={120}
                        placeholder="np. 1.6 Turbo 170 KM, automat"
                        value={variant}
                        onChange={(e) => setVariant(e.target.value)}
                      />
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
                <p className="mt-4 text-xs text-steel">
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
              </div>
            </div>

            <div className="panel">
              <PanelHeading
                mark="B"
                title="Instrukcje"
                hint={`${docs.length} z ${maxDocs} plików`}
              />
              <div className="p-4 sm:p-5">
                <div
                  className={`wizard-drop p-3 sm:p-4 ${dragging ? "wizard-drop-active" : ""} ${
                    docs.length === 0 ? "py-10 sm:py-12" : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <div
                    className={`flex flex-wrap items-center gap-3 text-sm ${
                      docs.length === 0
                        ? "flex-col justify-center text-center"
                        : "justify-between"
                    }`}
                  >
                    {docs.length === 0 && <DropIcon />}
                    <p className="text-graphite">
                      {docs.length === 0 ? (
                        <>
                          <strong className="block text-base text-ink">
                            Przeciągnij tutaj instrukcje w PDF
                          </strong>
                          np. instrukcja obsługi, instrukcja radia i nawigacji,
                          książka serwisowa – do {maxDocs} plików
                        </>
                      ) : (
                        "Przeciągnij kolejne pliki tutaj albo"
                      )}
                    </p>
                    <label
                      className={`btn cursor-pointer ${
                        docs.length >= maxDocs
                          ? "pointer-events-none opacity-50"
                          : ""
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
                  {docs.length > 0 && (
                    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
                            ) : d.previewState === "loading" ? (
                              <Skeleton className="h-3/4 w-3/4" />
                            ) : (
                              <span className="px-2 text-center text-xs text-steel">
                                Brak podglądu
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
                              {formatFileSize(d.file.size)}
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

                <p className="mt-4 text-xs leading-relaxed text-steel">
                  Każdy plik stanie się osobną instrukcją o nazwie wpisanej na
                  karcie. Pliki PDF są potrzebne tylko na czas odczytywania –
                  potem aplikacja je{" "}
                  <strong className="text-graphite">usuwa</strong>, a instrukcje
                  zostają już na stałe.
                </p>
              </div>
            </div>
          </div>

          <aside className="panel lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
            <h3 className="panel-title">Podsumowanie</h3>
            <div className="p-4 sm:p-5">
              <p className="section-label mb-0">{brand || "Marka"}</p>
              <p
                className={`type-card mt-0.5 ${
                  model ? "text-ink" : "text-silver"
                }`}
              >
                {model || "Model"}
              </p>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm">
                <dt className="text-steel">Rocznik</dt>
                <dd className="text-right font-semibold">{year || "–"}</dd>
                {brandIsOther && (
                  <>
                    <dt className="text-steel">Wersja</dt>
                    <dd className="text-right">{variant.trim() || "–"}</dd>
                  </>
                )}
                <dt className="text-steel">Instrukcje</dt>
                <dd className="text-right font-semibold">
                  {docs.length}
                  {docs.some((d) => d.pages != null) && (
                    <span className="font-normal text-graphite">
                      {" "}
                      · {docs.reduce((n, d) => n + (d.pages ?? 0), 0)} str.
                    </span>
                  )}
                </dd>
              </dl>
              {formErrors.length > 0 ? (
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-xs text-graphite">
                  {formErrors.map((e) => (
                    <li key={e} className="flex gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-1 h-1.5 w-1.5 shrink-0 bg-red"
                      />
                      {e}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 border-t border-line pt-3 text-xs text-graphite">
                  Wszystko gotowe – możesz dodać auto.
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary mt-5 w-full justify-center py-2.5 text-base"
                disabled={formErrors.length > 0 || !ready}
                onClick={submit}
              >
                Dodaj auto
                {docs.length > 0
                  ? ` i ${docs.length} ${plural(docs.length, "instrukcję", "instrukcje", "instrukcji")}`
                  : ""}{" "}
                →
              </button>
              {!ready && formErrors.length === 0 && (
                <p className="mt-2 text-xs text-red">
                  Dodawanie jest teraz niedostępne – zobacz komunikat na górze.
                </p>
              )}
            </div>
          </aside>
        </section>
      )}

      {step === 2 && (
        <StepProcessing
          upload={upload}
          job={job}
          picked={docs.map((d) => ({ title: d.title, preview: d.preview }))}
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
