/** Types, constants and data loading shared by the steps of the add-car wizard. */

import type { CatalogBrand } from "@/lib/catalog";

export interface SystemStatus {
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

export interface JobDoc {
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

export interface Job {
  id: string;
  carId: string;
  label: string;
  state: "running" | "done" | "error";
  error?: string;
  pdfsDeleted: boolean;
  docs: JobDoc[];
}

export interface PickedDoc {
  key: string;
  file: File;
  title: string;
  pages: number | null;
  preview: string | null;
  previewState: "loading" | "done" | "error";
}

export type Step = 1 | 2 | 3 | 4;

export const STEPS: { n: Step; label: string; hint: string }[] = [
  {
    n: 1,
    label: "Auto i instrukcje",
    hint: "marka, model, rocznik i pliki PDF",
  },
  { n: 2, label: "Odczytywanie", hint: "aplikacja czyta instrukcje" },
  { n: 3, label: "Wyposażenie", hint: "co ma Twoje auto" },
  { n: 4, label: "Gotowe", hint: "auto pojawia się na liście" },
];

export const OTHER = "__other__";

export const BRAND_GROUPS: {
  label: string;
  filter: (b: CatalogBrand) => boolean;
}[] = [
  { label: "Popularne marki", filter: (b) => b.popular && !b.usOnly },
  { label: "Pozostałe marki", filter: (b) => !b.popular && !b.usOnly },
  { label: "Marki z rynku amerykańskiego", filter: (b) => b.usOnly },
];

/** Lists from the official catalogue, loaded on demand. */
export type Loadable<T> =
  | { state: "loading" }
  | { state: "done"; items: T[] }
  | { state: "error"; error: string };

export async function fetchList<T>(url: string, key: string): Promise<T[]> {
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
