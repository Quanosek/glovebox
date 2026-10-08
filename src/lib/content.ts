import fs from "node:fs";
import path from "node:path";
import { matchFeatures } from "@/config/featureRules";
import type { FeatureId } from "@/config/vehicle";
import {
  CASCADA_PROFILE,
  bookHref,
  carHref,
  carLabel,
  type CarBook,
  type CarFile,
  type CarSummary,
} from "@/lib/cars";
import { isValidId } from "@/lib/slug";
import type {
  Block,
  BookIndex,
  ChapterFile,
  Run,
  SectionMeta,
  WarningBlock,
} from "@/content/types";

/**
 * Server-side access to the manuals stored in `database/`:
 *
 *   database/<car>/car.json              car description + list of books
 *   database/<car>/<book>/index.json     table of contents
 *   database/<car>/<book>/<chapter>.json blocks of every section
 *   database/<car>/assets/<book>/…       WebP images (served by /media)
 *
 * Files are re-read when they change on disk, so cars added by the import
 * wizard show up without restarting the server.
 * Never import this module from client components.
 */

export function getDatabaseDir(): string {
  return process.env.MANUALS_DATABASE_DIR
    ? path.resolve(process.env.MANUALS_DATABASE_DIR)
    : path.join(process.cwd(), "database");
}

export interface BookCtx {
  car: CarFile;
  book: CarBook;
}

const jsonCache = new Map<string, { mtime: number; value: unknown }>();

function readJson<T>(file: string): T | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    jsonCache.delete(file);
    return null;
  }
  const hit = jsonCache.get(file);
  if (hit && hit.mtime === stat.mtimeMs) return hit.value as T;
  const value = JSON.parse(fs.readFileSync(file, "utf8")) as T;
  jsonCache.set(file, { mtime: stat.mtimeMs, value });
  return value;
}

/* ----------------------------------------------------------------- cars */

export function listCars(): CarFile[] {
  const dir = getDatabaseDir();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const cars: CarFile[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !isValidId(e.name)) continue;
    const car = getCar(e.name);
    if (car) cars.push(car);
  }
  return cars.sort(
    (a, b) =>
      Number(Boolean(b.builtIn)) - Number(Boolean(a.builtIn)) ||
      carLabel(a).localeCompare(carLabel(b), "pl"),
  );
}

export function getCar(id: string): CarFile | undefined {
  if (!isValidId(id)) return undefined;
  try {
    const car = readJson<CarFile>(path.join(getDatabaseDir(), id, "car.json"));
    if (!car || car.id !== id || !Array.isArray(car.books)) return undefined;
    return car;
  } catch {
    return undefined;
  }
}

export function getBookCtx(carId: string, route: string): BookCtx | undefined {
  const car = getCar(carId);
  const book = car?.books.find((b) => b.route === route);
  if (!car || !book || !isValidId(book.id)) return undefined;
  if (!getBookIndex({ car, book })) return undefined;
  return { car, book };
}

export function bookCtxs(car: CarFile): BookCtx[] {
  return car.books
    .filter((book) => isValidId(book.id))
    .map((book) => ({ car, book }))
    .filter((ctx) => getBookIndex(ctx) != null);
}

export function getCarSummary(car: CarFile): CarSummary {
  return {
    id: car.id,
    brand: car.brand,
    model: car.model,
    year: car.year,
    variant: car.variant,
    label: carLabel(car),
    href: carHref(car.id),
    builtIn: Boolean(car.builtIn),
    hasProfile: car.profile === CASCADA_PROFILE,
    books: bookCtxs(car).map((ctx) => {
      const index = getBook(ctx);
      return {
        ...ctx.book,
        href: bookHref(car.id, ctx.book.route),
        sections: index.sections.length,
        pages: index.source.pages,
        placeholder: Boolean(index.placeholder),
      };
    }),
  };
}

export function listCarSummaries(): CarSummary[] {
  return listCars().map(getCarSummary);
}

/* ---------------------------------------------------------------- books */

function bookDir({ car, book }: BookCtx): string {
  return path.join(getDatabaseDir(), car.id, book.id);
}

function getBookIndex(ctx: BookCtx): BookIndex | null {
  try {
    return readJson<BookIndex>(path.join(bookDir(ctx), "index.json"));
  } catch {
    return null;
  }
}

export function getBook(ctx: BookCtx): BookIndex {
  const index = getBookIndex(ctx);
  if (!index) throw new Error(`Missing book ${ctx.car.id}/${ctx.book.id}`);
  return index;
}

export function getSection(
  ctx: BookCtx,
  slug: string[],
): SectionMeta | undefined {
  const key = slug.map((s) => decodeURIComponent(s)).join("/");
  return getBook(ctx).sections.find((s) => s.id === key);
}

export function getBlocks(ctx: BookCtx, section: SectionMeta): Block[] {
  const file = path.join(bookDir(ctx), path.basename(section.file));
  const chapter = readJson<ChapterFile>(file);
  return chapter?.sections[section.id] ?? [];
}

export function sectionHref(
  ctx: BookCtx,
  section: Pick<SectionMeta, "slug">,
): string {
  return `${bookHref(ctx.car.id, ctx.book.route)}/${section.slug.join("/")}`;
}

export function getChildren(
  ctx: BookCtx,
  section: SectionMeta | null,
): SectionMeta[] {
  const parentId = section ? section.id : null;
  return getBook(ctx).sections.filter((s) => s.parentId === parentId);
}

export function getAncestors(
  ctx: BookCtx,
  section: SectionMeta,
): SectionMeta[] {
  const sections = getBook(ctx).sections;
  const out: SectionMeta[] = [];
  let parentId = section.parentId;
  while (parentId) {
    const parent = sections.find((s) => s.id === parentId);
    if (!parent) break;
    out.unshift(parent);
    parentId = parent.parentId;
  }
  return out;
}

export function getPrevNext(ctx: BookCtx, section: SectionMeta) {
  const sections = getBook(ctx).sections;
  const i = sections.findIndex((s) => s.id === section.id);
  return {
    prev: i > 0 ? sections[i - 1] : null,
    next: i >= 0 && i < sections.length - 1 ? sections[i + 1] : null,
  };
}

/**
 * Features of a section, including the ones inherited from its ancestors.
 * Only cars with the Cascada profile are tagged.
 */
export function getSectionFeatures(
  ctx: BookCtx,
  section: SectionMeta,
): FeatureId[] {
  if (ctx.car.profile !== CASCADA_PROFILE) return [];
  const chain = [...getAncestors(ctx, section), section];
  const out: FeatureId[] = [];
  for (const s of chain) {
    for (const f of matchFeatures(ctx.book.id, s.title))
      if (!out.includes(f)) out.push(f);
  }
  return out;
}

export interface TocNode {
  id: string;
  title: string;
  href: string;
  level: number;
  features: FeatureId[];
  children: TocNode[];
}

export function getTocTree(ctx: BookCtx): TocNode[] {
  const roots: TocNode[] = [];
  const byId = new Map<string, TocNode>();
  for (const s of getBook(ctx).sections) {
    const node: TocNode = {
      id: s.id,
      title: s.title,
      href: sectionHref(ctx, s),
      level: s.level,
      features: getSectionFeatures(ctx, s),
      children: [],
    };
    byId.set(s.id, node);
    const parent = s.parentId ? byId.get(s.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Maps a printed page number to the first block printed on that page. */
export function resolvePageRef(ctx: BookCtx, page: number): string | null {
  const map = getPageMap(ctx);
  for (let p = page; p >= page - 3 && p > 0; p--) {
    const hit = map.get(p);
    if (hit) return hit;
  }
  return null;
}

const pageMaps = new Map<
  string,
  { index: BookIndex; map: Map<number, string> }
>();

function getPageMap(ctx: BookCtx): Map<number, string> {
  const key = `${ctx.car.id}/${ctx.book.id}`;
  const index = getBook(ctx);
  const cached = pageMaps.get(key);
  // The index object is replaced when the file changes on disk.
  if (cached && cached.index === index) return cached.map;
  const map = new Map<number, string>();
  for (const s of index.sections) {
    const href = sectionHref(ctx, s);
    if (s.page != null && !map.has(s.page)) map.set(s.page, href);
    for (const b of getBlocks(ctx, s)) {
      if (b.page != null && !map.has(b.page))
        map.set(b.page, `${href}#${b.id}`);
    }
  }
  pageMaps.set(key, { index, map });
  return map;
}

export function runsToText(runs: Run[]): string {
  return runs
    .map((r) =>
      typeof r === "string" ? r : "page" in r ? `str. ${r.page}` : r.t,
    )
    .join("");
}

export function blockToText(block: Block): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return runsToText(block.runs);
    case "list":
      return block.items.map(runsToText).join("\n");
    case "warning":
      return [block.title, ...block.blocks.map(blockToText)].join("\n");
    case "table":
      return block.rows.map((r) => r.join(" | ")).join("\n");
    case "image":
      return "";
  }
}

export interface WarningEntry {
  car: string;
  book: CarBook;
  section: SectionMeta;
  href: string;
  block: WarningBlock;
  features: FeatureId[];
}

export function getAllWarnings(): WarningEntry[] {
  const out: WarningEntry[] = [];
  for (const car of listCars()) {
    for (const ctx of bookCtxs(car)) {
      for (const s of getBook(ctx).sections) {
        const features = getSectionFeatures(ctx, s);
        for (const b of getBlocks(ctx, s)) {
          if (b.type === "warning") {
            out.push({
              car: car.id,
              book: ctx.book,
              section: s,
              href: `${sectionHref(ctx, s)}#${b.id}`,
              block: b,
              features,
            });
          }
        }
      }
    }
  }
  return out;
}

export interface SearchDoc {
  id: string;
  car: string;
  book: string;
  bookTitle: string;
  title: string;
  path: string;
  href: string;
  text: string;
  features: FeatureId[];
}

export function getSearchDocs(car: CarFile): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const ctx of bookCtxs(car)) {
    for (const s of getBook(ctx).sections) {
      const trail = getAncestors(ctx, s).map((a) => a.title);
      docs.push({
        id: `${ctx.book.id}:${s.id}`,
        car: car.id,
        book: ctx.book.id,
        bookTitle: ctx.book.short,
        title: s.title,
        path: trail.join(" › "),
        href: sectionHref(ctx, s),
        text: getBlocks(ctx, s).map(blockToText).join("\n"),
        features: getSectionFeatures(ctx, s),
      });
    }
  }
  return docs;
}

/** Every page and image URL of a car (used for "save for offline"). */
export function getCarUrls(car: CarFile): string[] {
  const urls = new Set<string>([carHref(car.id)]);
  for (const ctx of bookCtxs(car)) {
    urls.add(bookHref(car.id, ctx.book.route));
    for (const s of getBook(ctx).sections) {
      urls.add(sectionHref(ctx, s));
      for (const b of getBlocks(ctx, s)) collectImages(b, urls);
    }
  }
  return [...urls];
}

function collectImages(block: Block, urls: Set<string>) {
  if (block.type === "image") urls.add(block.src);
  if (block.type === "warning")
    block.blocks.forEach((b) => collectImages(b, urls));
}

export interface FeatureSectionLink {
  book: string;
  title: string;
  href: string;
}

/** Sections whose own title is tagged with each feature (not inherited). */
export function getFeatureSections(
  car: CarFile,
): Record<string, FeatureSectionLink[]> {
  const out: Record<string, FeatureSectionLink[]> = {};
  if (car.profile !== CASCADA_PROFILE) return out;
  for (const ctx of bookCtxs(car)) {
    for (const s of getBook(ctx).sections) {
      for (const f of matchFeatures(ctx.book.id, s.title)) {
        (out[f] ??= []).push({
          book: ctx.book.id,
          title: s.title,
          href: sectionHref(ctx, s),
        });
      }
    }
  }
  return out;
}
