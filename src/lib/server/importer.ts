import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CarBook, CarFile } from "@/lib/cars";
import { getCar, getDatabaseDir } from "@/lib/content";
import { isValidId, slugify, uniqueSlug } from "@/lib/slug";
import { findPython, run } from "./python";

/**
 * Imports a new car from uploaded PDF manuals:
 *
 * 1. PDFs are written to a private temporary directory (never to the repo).
 * 2. `scripts/extract.py` converts each PDF into JSON + WebP images inside a
 *    hidden staging folder `database/.import-<job>/`.
 * 3. `car.json` is written and the staging folder is renamed to
 *    `database/<car>/` in one step.
 * 4. The temporary PDFs are always deleted, whether the import succeeded or not.
 *
 * Jobs run in the background inside the Next.js server process; the wizard
 * polls `GET /api/jobs/<id>` for progress.
 */

export const MAX_DOCUMENTS = 10;
export const MAX_FILE_BYTES = 250 * 1024 * 1024;
export const MIN_YEAR = 1950;
export const maxYear = () => new Date().getFullYear() + 1;

export type DocState = "queued" | "running" | "done" | "error";

export interface ImportDocStatus {
  name: string;
  title: string;
  bookId: string;
  size: number;
  state: DocState;
  pages?: number;
  sections?: number;
  images?: number;
  /** Last lines of the extractor output. */
  log: string[];
  error?: string;
}

export interface ImportJob {
  id: string;
  carId: string;
  label: string;
  state: "running" | "done" | "error";
  startedAt: string;
  finishedAt?: string;
  error?: string;
  /** True once the uploaded PDFs have been deleted. */
  pdfsDeleted: boolean;
  docs: ImportDocStatus[];
}

export interface ImportRequest {
  brand: string;
  model: string;
  year: number;
  variant?: string;
  docs: Array<{ file: File; title: string }>;
}

export class ImportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const globalJobs = globalThis as unknown as {
  __manualImportJobs?: Map<string, ImportJob>;
  __manualImportStarting?: boolean;
};
const jobs = (globalJobs.__manualImportJobs ??= new Map<string, ImportJob>());

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id);
}

export function runningJob(): ImportJob | undefined {
  if (globalJobs.__manualImportStarting) return RESERVED;
  return [...jobs.values()].find((j) => j.state === "running");
}

/** Placeholder returned while a new job is being set up. */
const RESERVED: ImportJob = {
  id: "",
  carId: "",
  label: "",
  state: "running",
  startedAt: "",
  pdfsDeleted: false,
  docs: [],
};

const clean = (v: string, max = 60) =>
  v.replace(/\s+/g, " ").trim().slice(0, max);

/** Validates the request; throws `ImportError` with a Polish message. */
export function validateImport(req: ImportRequest): ImportRequest {
  const brand = clean(req.brand);
  const model = clean(req.model);
  const variant = req.variant ? clean(req.variant, 120) : undefined;
  if (!brand || !slugify(brand)) throw new ImportError("Podaj markę auta.");
  if (!model || !slugify(model)) throw new ImportError("Podaj model auta.");
  if (
    !Number.isInteger(req.year) ||
    req.year < MIN_YEAR ||
    req.year > maxYear()
  )
    throw new ImportError("Podaj prawidłowy rocznik.");
  if (req.docs.length === 0)
    throw new ImportError("Dodaj co najmniej jeden plik PDF.");
  if (req.docs.length > MAX_DOCUMENTS)
    throw new ImportError(`Można dodać najwyżej ${MAX_DOCUMENTS} dokumentów.`);
  for (const d of req.docs) {
    if (!/\.pdf$/i.test(d.file.name) && d.file.type !== "application/pdf")
      throw new ImportError(`Plik „${d.file.name}” nie jest plikiem PDF.`);
    if (d.file.size === 0)
      throw new ImportError(`Plik „${d.file.name}” jest pusty.`);
    if (d.file.size > MAX_FILE_BYTES)
      throw new ImportError(
        `Plik „${d.file.name}” jest za duży (limit ${MAX_FILE_BYTES / 1024 / 1024} MB).`,
      );
  }
  return {
    brand,
    model,
    year: req.year,
    variant,
    docs: req.docs.map((d) => ({
      file: d.file,
      title:
        clean(d.title, 120) || clean(d.file.name.replace(/\.pdf$/i, ""), 120),
    })),
  };
}

async function existingIds(): Promise<string[]> {
  try {
    return await fs.readdir(getDatabaseDir());
  } catch {
    return [];
  }
}

/** Stores the PDFs in a temp dir and starts the background extraction. */
export async function startImport(input: ImportRequest): Promise<ImportJob> {
  const req = validateImport(input);
  if (runningJob())
    throw new ImportError(
      "Trwa już przetwarzanie innego auta. Poczekaj na jego zakończenie.",
      409,
    );
  globalJobs.__manualImportStarting = true;
  try {
    return await prepareJob(req);
  } finally {
    globalJobs.__manualImportStarting = false;
  }
}

async function prepareJob(req: ImportRequest): Promise<ImportJob> {
  const python = (await findPython()).best;
  if (!python)
    throw new ImportError(
      "Brak Pythona 3 z bibliotekami PyMuPDF i Pillow — wróć do kroku „Wymagania”.",
      503,
    );

  const label = `${req.brand} ${req.model} ${req.year}`;
  const carId = uniqueSlug(slugify(label, 70), await existingIds());
  const id = randomUUID();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "manual-import-"));

  const usedBooks: string[] = ["assets"];
  const docs: ImportDocStatus[] = [];
  const pdfPaths: string[] = [];
  try {
    for (const [i, d] of req.docs.entries()) {
      const bytes = Buffer.from(await d.file.arrayBuffer());
      if (bytes.subarray(0, 1024).indexOf("%PDF-") === -1)
        throw new ImportError(
          `Plik „${d.file.name}” nie jest prawidłowym PDF.`,
        );
      const dir = path.join(tmp, String(i + 1));
      await fs.mkdir(dir);
      const name = `${slugify(d.file.name.replace(/\.pdf$/i, "")) || "dokument"}.pdf`;
      const file = path.join(dir, name);
      await fs.writeFile(file, bytes);
      pdfPaths.push(file);
      const bookId = uniqueSlug(
        slugify(d.title, 50) || `dokument-${i + 1}`,
        usedBooks,
      );
      usedBooks.push(bookId);
      docs.push({
        name: d.file.name,
        title: d.title,
        bookId,
        size: d.file.size,
        state: "queued",
        log: [],
      });
    }
  } catch (err) {
    await fs.rm(tmp, { recursive: true, force: true });
    throw err;
  }

  const job: ImportJob = {
    id,
    carId,
    label,
    state: "running",
    startedAt: new Date().toISOString(),
    pdfsDeleted: false,
    docs,
  };
  jobs.set(id, job);
  void processJob(job, req, python.command, tmp, pdfPaths);
  return job;
}

async function processJob(
  job: ImportJob,
  req: ImportRequest,
  python: string,
  tmp: string,
  pdfPaths: string[],
) {
  const db = getDatabaseDir();
  const staging = path.join(db, `.import-${job.id}`);
  try {
    await fs.mkdir(staging, { recursive: true });
    for (const [i, doc] of job.docs.entries()) {
      doc.state = "running";
      const args = [
        path.join(process.cwd(), "scripts", "extract.py"),
        "--book",
        doc.bookId,
        "--pdf",
        pdfPaths[i],
        "--out",
        path.join(staging, doc.bookId),
        "--assets",
        path.join(staging, "assets", doc.bookId),
        "--assets-url",
        `/media/${job.carId}/${doc.bookId}`,
        "--title",
        doc.title,
      ];
      const r = await run(python, args, {
        onLine: (line) => {
          doc.log.push(line.slice(0, 300));
          if (doc.log.length > 12) doc.log.shift();
        },
      });
      const stats = /sections: (\d+), chapters: \d+, unique images: (\d+)/.exec(
        r.stdout,
      );
      const pages = /: (\d+) pages/.exec(r.stdout);
      if (r.code !== 0 || !stats) {
        doc.state = "error";
        doc.error =
          lastLines(r.stderr) || "Nie udało się przetworzyć dokumentu.";
        throw new Error(`Błąd przetwarzania „${doc.name}”.`);
      }
      doc.sections = Number(stats[1]);
      doc.images = Number(stats[2]);
      if (pages) doc.pages = Number(pages[1]);
      doc.state = "done";
    }

    const books: CarBook[] = job.docs.map((d) => ({
      id: d.bookId,
      route: d.bookId,
      title: d.title,
      short: d.title.length > 32 ? `${d.title.slice(0, 31)}…` : d.title,
    }));
    const car: CarFile = {
      formatVersion: 1,
      id: job.carId,
      brand: req.brand,
      model: req.model,
      year: req.year,
      ...(req.variant ? { variant: req.variant } : {}),
      createdAt: new Date().toISOString(),
      books,
    };
    await fs.writeFile(
      path.join(staging, "car.json"),
      `${JSON.stringify(car, null, 2)}\n`,
      "utf8",
    );
    const target = path.join(db, job.carId);
    if (await exists(target))
      throw new Error(`Folder database/${job.carId} już istnieje.`);
    await fs.rename(staging, target);
    job.state = "done";
  } catch (err) {
    job.state = "error";
    job.error = err instanceof Error ? err.message : String(err);
    for (const d of job.docs) if (d.state === "queued") d.state = "error";
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    job.pdfsDeleted = !(await exists(tmp));
    job.finishedAt = new Date().toISOString();
  }
}

function lastLines(text: string, n = 6): string {
  return text.trim().split(/\r?\n/).slice(-n).join("\n");
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Removes a user-added car folder from `database/`. */
export async function deleteCar(id: string): Promise<void> {
  if (!isValidId(id))
    throw new ImportError("Nieprawidłowy identyfikator.", 400);
  const car = getCar(id);
  if (!car) throw new ImportError("Nie znaleziono auta.", 404);
  if (car.builtIn)
    throw new ImportError("Wbudowanego auta nie można usunąć.", 403);
  if (runningJob()?.carId === id)
    throw new ImportError("Auto jest właśnie przetwarzane.", 409);
  await fs.rm(path.join(getDatabaseDir(), id), {
    recursive: true,
    force: true,
  });
}
