import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { matchFeatures } from "@/config/featureRules";
import type { FeatureId } from "@/config/vehicle";
import {
  bookHref,
  carHref,
  carLabel,
  equipmentHref,
  glossaryHref,
  techDataHref,
  type CarBook,
  type CarFile,
  type CarSummary,
  type FeatureSectionLink,
} from "@/lib/cars";
import { blockToText, runsToText } from "@/lib/overview";
import { isValidId } from "@/lib/slug";
import type {
  Block,
  BookIndex,
  ChapterFile,
  HeadingBlock,
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
  return cars.sort((a, b) => carLabel(a).localeCompare(carLabel(b), "pl"));
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
    variant: car.spec ? undefined : car.variant,
    label: carLabel(car),
    href: carHref(car.id),
    ...(car.spec ? { spec: car.spec } : {}),
    ...(car.catalog ? { catalog: car.catalog } : {}),
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
  return listCars()
    .map(getCarSummary)
    .filter((car) => car.books.some((book) => !book.placeholder));
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

/** Features of a section, including the ones inherited from its ancestors. */
export function getSectionFeatures(
  ctx: BookCtx,
  section: SectionMeta,
): FeatureId[] {
  const chain = [...getAncestors(ctx, section), section];
  const out: FeatureId[] = [];
  for (const s of chain) {
    for (const f of matchFeatures(ctx.book.id, s.title))
      if (!out.includes(f)) out.push(f);
  }
  return out;
}

/**
 * Blocks of a section, with the parts that start at a heading mentioning
 * optional equipment grouped (a part runs until the next heading of the same
 * or a higher level). Manuals often describe equipment under headings inside
 * a longer section, e.g. "Tempomat" inside "Systemy wspomagania kierowcy".
 */
export type FeatureNode =
  | { kind: "block"; block: Block }
  | {
      kind: "part";
      heading: HeadingBlock;
      /** Features of this part not already inherited from outside it. */
      features: FeatureId[];
      children: FeatureNode[];
    };

export function getFeatureTree(
  ctx: BookCtx,
  blocks: Block[],
  inherited: readonly FeatureId[],
): FeatureNode[] {
  const build = (
    from: number,
    to: number,
    outer: readonly FeatureId[],
  ): FeatureNode[] => {
    const nodes: FeatureNode[] = [];
    let i = from;
    while (i < to) {
      const block = blocks[i];
      const features =
        block.type === "heading"
          ? matchFeatures(ctx.book.id, runsToText(block.runs)).filter(
              (f) => !outer.includes(f),
            )
          : [];
      if (block.type !== "heading" || features.length === 0) {
        nodes.push({ kind: "block", block });
        i++;
        continue;
      }
      let end = i + 1;
      while (end < to) {
        const b = blocks[end];
        if (b.type === "heading" && b.level <= block.level) break;
        end++;
      }
      nodes.push({
        kind: "part",
        heading: block,
        features,
        children: build(i + 1, end, [...outer, ...features]),
      });
      i = end;
    }
    return nodes;
  };
  return build(0, blocks.length, inherited);
}

/** Calls `fn` for every top-level block with all features that apply to it. */
function forEachBlockFeatures(
  nodes: FeatureNode[],
  outer: FeatureId[],
  fn: (block: Block, features: FeatureId[]) => void,
) {
  for (const n of nodes) {
    if (n.kind === "block") fn(n.block, outer);
    else {
      const inner = [...outer, ...n.features];
      fn(n.heading, inner);
      forEachBlockFeatures(n.children, inner, fn);
    }
  }
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

export { blockToText, runsToText };

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
        const inherited = getSectionFeatures(ctx, s);
        const tree = getFeatureTree(ctx, getBlocks(ctx, s), inherited);
        forEachBlockFeatures(tree, inherited, (b, features) => {
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
        });
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
  const urls = new Set<string>([
    carHref(car.id),
    equipmentHref(car.id),
    glossaryHref(car.id),
    techDataHref(car.id),
  ]);
  for (const ctx of bookCtxs(car)) {
    urls.add(bookHref(car.id, ctx.book.route));
    for (const s of getBook(ctx).sections) {
      urls.add(sectionHref(ctx, s));
      for (const b of getBlocks(ctx, s)) collectImages(b, urls);
    }
  }
  return [...urls];
}

/**
 * Fingerprint of everything a car's offline copy depends on: the JSON files
 * of the car and the current app build (new builds change asset names).
 * Clients re-save a car for offline use when this value changes.
 */
export function getCarVersion(car: CarFile): string {
  const hash = createHash("sha1");
  const carDir = path.join(getDatabaseDir(), car.id);
  const stamp = (file: string) => {
    try {
      const st = fs.statSync(file);
      hash.update(`${file}:${st.size}:${st.mtimeMs};`);
    } catch {
      hash.update(`${file}:-;`);
    }
  };
  stamp(path.join(carDir, "car.json"));
  for (const ctx of bookCtxs(car)) {
    const dir = bookDir(ctx);
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.endsWith(".json")) stamp(path.join(dir, name));
    }
  }
  try {
    hash.update(
      fs.readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8"),
    );
  } catch {
    hash.update("dev");
  }
  return hash.digest("hex").slice(0, 16);
}

function collectImages(block: Block, urls: Set<string>) {
  if (block.type === "image") urls.add(block.src);
  const addIcons = (runs: Run[]) => {
    for (const r of runs)
      if (typeof r !== "string" && "icon" in r) urls.add(r.icon);
  };
  if (block.type === "paragraph" || block.type === "heading")
    addIcons(block.runs);
  if (block.type === "list") block.items.forEach(addIcons);
  if (block.type === "warning")
    block.blocks.forEach((b) => collectImages(b, urls));
}

/**
 * Places in the manuals of a car that describe each optional feature:
 * sections whose own title mentions it and headings inside sections.
 */
export function getFeatureSections(
  car: CarFile,
): Record<string, FeatureSectionLink[]> {
  const out: Record<string, FeatureSectionLink[]> = {};
  const add = (f: string, link: FeatureSectionLink) => {
    const list = (out[f] ??= []);
    if (!list.some((l) => l.href === link.href)) list.push(link);
  };
  const walk = (ctx: BookCtx, href: string, nodes: FeatureNode[]) => {
    for (const n of nodes) {
      if (n.kind !== "part") continue;
      for (const f of n.features)
        add(f, {
          book: ctx.book.id,
          bookShort: ctx.book.short,
          title: runsToText(n.heading.runs),
          href: `${href}#${n.heading.id}`,
        });
      walk(ctx, href, n.children);
    }
  };
  for (const ctx of bookCtxs(car)) {
    for (const s of getBook(ctx).sections) {
      const href = sectionHref(ctx, s);
      for (const f of matchFeatures(ctx.book.id, s.title))
        add(f, {
          book: ctx.book.id,
          bookShort: ctx.book.short,
          title: s.title,
          href,
        });
      const inherited = getSectionFeatures(ctx, s);
      walk(ctx, href, getFeatureTree(ctx, getBlocks(ctx, s), inherited));
    }
  }
  return out;
}
