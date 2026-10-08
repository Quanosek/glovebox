import fs from "node:fs";
import path from "node:path";
import { matchFeatures } from "@/config/featureRules";
import type { FeatureId } from "@/config/vehicle";
import type {
  Block,
  BookId,
  BookIndex,
  ChapterFile,
  Run,
  SectionMeta,
  WarningBlock,
} from "@/content/types";

/**
 * Server-side (build-time) access to the generated manual content.
 * Never import this module from client components.
 */

export interface BookInfo {
  id: BookId;
  /** URL segment. */
  route: string;
  /** Short label used in navigation. */
  short: string;
}

export const BOOKS: BookInfo[] = [
  { id: "manual", route: "instrukcja", short: "Instrukcja obsługi" },
  { id: "infotainment", route: "navi-950", short: "Navi 950" },
];

const CONTENT_DIR = path.join(process.cwd(), "src", "content");

const indexCache = new Map<BookId, BookIndex>();
const chapterCache = new Map<string, ChapterFile>();

export function getBookInfo(id: BookId): BookInfo {
  return BOOKS.find((b) => b.id === id)!;
}

export function getBookByRoute(route: string): BookInfo | undefined {
  return BOOKS.find((b) => b.route === route);
}

export function getBook(id: BookId): BookIndex {
  let index = indexCache.get(id);
  if (!index) {
    const file = path.join(CONTENT_DIR, id, "index.json");
    index = JSON.parse(fs.readFileSync(file, "utf8")) as BookIndex;
    indexCache.set(id, index);
  }
  return index;
}

export function getSection(id: BookId, slug: string[]): SectionMeta | undefined {
  const key = slug.map((s) => decodeURIComponent(s)).join("/");
  return getBook(id).sections.find((s) => s.id === key);
}

export function getBlocks(id: BookId, section: SectionMeta): Block[] {
  const key = `${id}/${section.file}`;
  let chapter = chapterCache.get(key);
  if (!chapter) {
    const file = path.join(CONTENT_DIR, id, section.file);
    chapter = fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, "utf8")) as ChapterFile)
      : { formatVersion: 1, sections: {} };
    chapterCache.set(key, chapter);
  }
  return chapter.sections[section.id] ?? [];
}

export function sectionHref(id: BookId, section: Pick<SectionMeta, "slug">): string {
  return `/${getBookInfo(id).route}/${section.slug.join("/")}`;
}

export function getChildren(id: BookId, section: SectionMeta | null): SectionMeta[] {
  const parentId = section ? section.id : null;
  return getBook(id).sections.filter((s) => s.parentId === parentId);
}

export function getAncestors(id: BookId, section: SectionMeta): SectionMeta[] {
  const sections = getBook(id).sections;
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

export function getPrevNext(id: BookId, section: SectionMeta) {
  const sections = getBook(id).sections;
  const i = sections.findIndex((s) => s.id === section.id);
  return {
    prev: i > 0 ? sections[i - 1] : null,
    next: i >= 0 && i < sections.length - 1 ? sections[i + 1] : null,
  };
}

/** Features of a section, including the ones inherited from its ancestors. */
export function getSectionFeatures(id: BookId, section: SectionMeta): FeatureId[] {
  const chain = [...getAncestors(id, section), section];
  const out: FeatureId[] = [];
  for (const s of chain) {
    for (const f of matchFeatures(id, s.title)) if (!out.includes(f)) out.push(f);
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

export function getTocTree(id: BookId): TocNode[] {
  const roots: TocNode[] = [];
  const byId = new Map<string, TocNode>();
  for (const s of getBook(id).sections) {
    const node: TocNode = {
      id: s.id,
      title: s.title,
      href: sectionHref(id, s),
      level: s.level,
      features: getSectionFeatures(id, s),
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
export function resolvePageRef(id: BookId, page: number): string | null {
  const map = getPageMap(id);
  for (let p = page; p >= page - 3 && p > 0; p--) {
    const hit = map.get(p);
    if (hit) return hit;
  }
  return null;
}

const pageMaps = new Map<BookId, Map<number, string>>();

function getPageMap(id: BookId): Map<number, string> {
  let map = pageMaps.get(id);
  if (map) return map;
  map = new Map();
  for (const s of getBook(id).sections) {
    const href = sectionHref(id, s);
    if (s.page != null && !map.has(s.page)) map.set(s.page, href);
    for (const b of getBlocks(id, s)) {
      if (b.page != null && !map.has(b.page)) map.set(b.page, `${href}#${b.id}`);
    }
  }
  pageMaps.set(id, map);
  return map;
}

export function runsToText(runs: Run[]): string {
  return runs
    .map((r) => (typeof r === "string" ? r : "page" in r ? `str. ${r.page}` : r.t))
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
  book: BookId;
  section: SectionMeta;
  href: string;
  block: WarningBlock;
  features: FeatureId[];
}

export function getAllWarnings(): WarningEntry[] {
  const out: WarningEntry[] = [];
  for (const book of BOOKS) {
    for (const s of getBook(book.id).sections) {
      const features = getSectionFeatures(book.id, s);
      for (const b of getBlocks(book.id, s)) {
        if (b.type === "warning") {
          out.push({ book: book.id, section: s, href: `${sectionHref(book.id, s)}#${b.id}`, block: b, features });
        }
      }
    }
  }
  return out;
}

export interface SearchDoc {
  id: string;
  book: BookId;
  bookTitle: string;
  title: string;
  path: string;
  href: string;
  text: string;
}

export function getSearchDocs(): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const book of BOOKS) {
    const index = getBook(book.id);
    for (const s of index.sections) {
      const trail = getAncestors(book.id, s).map((a) => a.title);
      docs.push({
        id: `${book.id}:${s.id}`,
        book: book.id,
        bookTitle: book.short,
        title: s.title,
        path: trail.join(" › "),
        href: sectionHref(book.id, s),
        text: getBlocks(book.id, s).map(blockToText).join("\n"),
      });
    }
  }
  return docs;
}
