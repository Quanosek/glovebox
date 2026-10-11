import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RESERVED_BOOK_ROUTES, type CarBook, type CarFile } from "@/lib/cars";
import { documentTitle } from "@/lib/files";
import { getBook, getCar, getDatabaseDir } from "@/lib/content";
import { isValidId, slugify, uniqueSlug } from "@/lib/slug";
import { CatalogUnavailableError, resolveCatalogCar } from "./catalog";
import { findPython, run } from "./python";

/**
 * Imports PDF manuals or reuses and reorders a saved car's manuals:
 *
 * 1. PDFs are written to a private temporary directory (never to the repo).
 * 2. `scripts/extract.py` converts each PDF into JSON + WebP images inside a
 *    hidden staging folder `database/.import-<job>/`.
 * 3. `car.json` is written and the staging folder is renamed to
 *    `database/<car>/` in one step.
 * 4. The temporary PDFs are always deleted, whether the import succeeded or not.
 *
 * Existing cars retain their book ids and metadata. New books are staged and
 * moved before replacing the manifest atomically; failed moves are rolled back.
 * Reuse without uploads only replaces the manifest and does not require Python.
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
  /**
   * `catalog`: brand/model are catalogue ids checked against the official
   * list; `other`: typed by hand. Engine choice belongs to the browser profile.
   */
  source: "catalog" | "other";
  brand: string;
  model: string;
  year: number;
  variant?: string;
  existingCar?: string;
  bookOrder?: string[];
  docs: Array<{ file: File; title: string }>;
}

/** Request after validation: display names and catalogue data resolved. */
interface ValidImport {
  brand: string;
  model: string;
  year: number;
  variant?: string;
  catalog?: { brand: string; model: string };
  existing?: CarFile;
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

/**
 * Validates the request; throws `ImportError` with a Polish message. Cars
 * from the catalogue are checked against the official list, so a model that
 * was never sold cannot be added.
 */
export async function validateImport(req: ImportRequest): Promise<ValidImport> {
  if (req.existingCar !== undefined && !isValidId(req.existingCar))
    throw new ImportError("Nieprawidłowe auto.");
  let brand = clean(req.brand);
  let model = clean(req.model);
  let variant = req.variant ? clean(req.variant, 120) : undefined;
  let catalog: ValidImport["catalog"];
  if (!brand || !slugify(brand)) throw new ImportError("Podaj markę auta.");
  if (!model || !slugify(model)) throw new ImportError("Podaj model auta.");
  if (
    !Number.isInteger(req.year) ||
    req.year < MIN_YEAR ||
    req.year > maxYear()
  )
    throw new ImportError("Podaj prawidłowy rocznik.");
  if (req.source === "catalog") {
    let resolved: Awaited<ReturnType<typeof resolveCatalogCar>>;
    try {
      resolved = await resolveCatalogCar({
        brand,
        model,
        year: req.year,
      });
    } catch (err) {
      if (err instanceof CatalogUnavailableError)
        throw new ImportError(err.message, 503);
      throw err;
    }
    if (typeof resolved === "string") throw new ImportError(resolved);
    ({ brand, model, catalog } = resolved);
    variant = undefined;
  } else if (req.source !== "other") {
    throw new ImportError("Wybierz markę z listy albo „Inna”.");
  }
  let existing: CarFile | undefined;
  if (req.existingCar !== undefined) {
    existing = getCar(req.existingCar);
    if (!existing) throw new ImportError("Nie znaleziono auta.", 404);
    if (
      slugify(existing.brand) !== slugify(brand) ||
      slugify(existing.model) !== slugify(model) ||
      existing.year !== req.year
    )
      throw new ImportError("Wybrane instrukcje dotyczą innego auta.");
    const order = req.bookOrder ?? [];
    const books = existing.books;
    if (
      books.some((b) => !isValidId(b.id) || !isValidId(b.route)) ||
      order.some((id) => !isValidId(id)) ||
      order.length !== books.length ||
      new Set(order).size !== order.length ||
      order.some((id) => !books.some((b) => b.id === id))
    )
      throw new ImportError("Wybierz każdą zapisaną instrukcję dokładnie raz.");
    existing = {
      ...existing,
      books: order.map((id) => books.find((b) => b.id === id)!),
    };
    const target = path.join(getDatabaseDir(), existing.id);
    if (!(await fs.lstat(target)).isDirectory())
      throw new ImportError("Nieprawidłowe auto.");
    if (
      (await exists(path.join(target, "assets"))) &&
      !(await fs.lstat(path.join(target, "assets"))).isDirectory()
    )
      throw new ImportError("Nieprawidłowe instrukcje.");
  } else if (req.bookOrder?.length) {
    throw new ImportError("Wybierz auto z zapisanymi instrukcjami.");
  }
  if (req.docs.length === 0 && !existing)
    throw new ImportError("Dodaj co najmniej jeden plik PDF.");
  if (req.docs.length + (existing?.books.length ?? 0) > MAX_DOCUMENTS)
    throw new ImportError(`Można dodać najwyżej ${MAX_DOCUMENTS} plików PDF.`);
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
    ...(catalog ? { catalog } : {}),
    ...(existing ? { existing } : {}),
    docs: req.docs.map((d) => ({
      file: d.file,
      title: clean(d.title, 120) || clean(documentTitle(d.file.name), 120),
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
  if (runningJob())
    throw new ImportError(
      "Trwa już dodawanie innego auta. Poczekaj, aż się zakończy.",
      409,
    );
  globalJobs.__manualImportStarting = true;
  try {
    const req = await validateImport(input);
    if (req.existing && req.docs.length === 0) {
      const job: ImportJob = {
        id: randomUUID(),
        carId: req.existing.id,
        label: `${req.brand} ${req.model} ${req.year}`,
        state: "done",
        startedAt: new Date().toISOString(),
        pdfsDeleted: true,
        docs: await savedDocs(req.existing),
      };
      await saveExisting(req.existing, job.id, []);
      job.finishedAt = new Date().toISOString();
      jobs.set(job.id, job);
      return job;
    }
    return await prepareJob(req);
  } finally {
    globalJobs.__manualImportStarting = false;
  }
}

async function prepareJob(req: ValidImport): Promise<ImportJob> {
  const python = (await findPython()).best;
  if (!python)
    throw new ImportError(
      "Ten komputer nie jest jeszcze przygotowany do odczytu plików PDF (opis w README, rozdział „Dodawanie aut”).",
      503,
    );

  const label = `${req.brand} ${req.model} ${req.year}`;
  const carId =
    req.existing?.id ?? uniqueSlug(slugify(label, 70), await existingIds());
  const id = randomUUID();

  const usedBooks: string[] = ["assets", ...RESERVED_BOOK_ROUTES];
  if (req.existing) {
    usedBooks.push(...req.existing.books.flatMap((b) => [b.id, b.route]));
    usedBooks.push(...(await fs.readdir(path.join(getDatabaseDir(), carId))));
    const assets = path.join(getDatabaseDir(), carId, "assets");
    if (await exists(assets)) usedBooks.push(...(await fs.readdir(assets)));
  }
  const reused = req.existing ? await savedDocs(req.existing) : [];
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "manual-import-"));
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
  void processJob(job, req, python.command, tmp, pdfPaths, reused);
  return job;
}

async function processJob(
  job: ImportJob,
  req: ValidImport,
  python: string,
  tmp: string,
  pdfPaths: string[],
  reused: ImportDocStatus[],
) {
  const db = getDatabaseDir();
  const staging = path.join(db, `.import-${job.id}`);
  let state: ImportJob["state"] = "done";
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
        doc.error = lastLines(r.stderr) || "Nie udało się odczytać instrukcji.";
        throw new Error(`Nie udało się odczytać pliku „${doc.name}”.`);
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
    const car: CarFile = req.existing
      ? {
          ...req.existing,
          books: [...req.existing.books, ...books],
        }
      : {
          formatVersion: 1,
          id: job.carId,
          brand: req.brand,
          model: req.model,
          year: req.year,
          ...(req.variant ? { variant: req.variant } : {}),
          ...(req.catalog ? { catalog: req.catalog } : {}),
          createdAt: new Date().toISOString(),
          books,
        };
    if (req.existing) {
      await saveExisting(car, job.id, books);
      job.docs = [...reused, ...job.docs];
    } else {
      await fs.writeFile(
        path.join(staging, "car.json"),
        `${JSON.stringify(car, null, 2)}\n`,
        "utf8",
      );
      const target = path.join(db, job.carId);
      if (await exists(target))
        throw new Error(`Auto o tej nazwie już istnieje.`);
      await fs.rename(staging, target);
    }
  } catch (err) {
    state = "error";
    job.error = err instanceof Error ? err.message : String(err);
    for (const d of job.docs) if (d.state === "queued") d.state = "error";
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    job.pdfsDeleted = !(await exists(tmp));
    job.finishedAt = new Date().toISOString();
    job.state = state;
  }
}

async function savedDocs(car: CarFile): Promise<ImportDocStatus[]> {
  return Promise.all(
    car.books.map(async (book) => {
      let index: ReturnType<typeof getBook>;
      try {
        index = getBook({ car, book });
      } catch {
        throw new ImportError("Nie udało się odczytać zapisanej instrukcji.");
      }
      const assets = path.join(getDatabaseDir(), car.id, "assets", book.id);
      const images = (await exists(assets))
        ? (
            await fs.readdir(assets, { recursive: true, withFileTypes: true })
          ).filter(
            (entry) =>
              entry.isFile() && /\.(webp|png|jpe?g)$/i.test(entry.name),
          ).length
        : 0;
      return {
        name: book.title,
        title: book.title,
        bookId: book.id,
        size: 0,
        state: "done",
        pages: index.source.pages ?? undefined,
        sections: index.sections.length,
        images,
        log: [],
      };
    }),
  );
}

/** New folders are rolled back unless the manifest is committed last. */
async function saveExisting(car: CarFile, jobId: string, added: CarBook[]) {
  const staging = path.join(getDatabaseDir(), `.import-${jobId}`);
  const target = path.join(getDatabaseDir(), car.id);
  const moved: string[] = [];
  let createdAssets = false;
  try {
    await fs.mkdir(staging, { recursive: true });
    await fs.writeFile(
      path.join(staging, "car.json"),
      `${JSON.stringify(car, null, 2)}\n`,
      "utf8",
    );
    if (added.length && !(await exists(path.join(target, "assets")))) {
      await fs.mkdir(path.join(target, "assets"));
      createdAssets = true;
    }
    for (const book of added) {
      for (const relative of [book.id, path.join("assets", book.id)]) {
        const destination = path.join(target, relative);
        if (await exists(destination))
          throw new Error("Instrukcja o tej nazwie już istnieje.");
        const source = path.join(staging, relative);
        if (!(await exists(source)) && relative !== book.id) continue;
        await fs.rename(source, destination);
        moved.push(destination);
      }
    }
    await fs.rename(
      path.join(staging, "car.json"),
      path.join(target, "car.json"),
    );
  } catch (err) {
    for (const destination of moved.reverse())
      await fs.rm(destination, { recursive: true, force: true });
    if (createdAssets) await fs.rmdir(path.join(target, "assets"));
    throw err;
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
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
  if (!isValidId(id)) throw new ImportError("Nieprawidłowe auto.", 400);
  if (runningJob()) throw new ImportError("Auto jest właśnie dodawane.", 409);
  globalJobs.__manualImportStarting = true;
  try {
    const car = getCar(id);
    if (!car) throw new ImportError("Nie znaleziono auta.", 404);
    await fs.rm(path.join(getDatabaseDir(), id), {
      recursive: true,
      force: true,
    });
  } finally {
    globalJobs.__manualImportStarting = false;
  }
}
