/**
 * Content model shared by the extraction scripts (`scripts/extract.py`)
 * and the reader. Generated JSON files in `src/content/<book>/` must match
 * these types. Bump `CONTENT_FORMAT_VERSION` when the shape changes.
 */

export const CONTENT_FORMAT_VERSION = 1;

export type BookId = "manual" | "infotainment";

/** Inline text run. Plain strings are regular text. */
export type Run =
  | string
  | { t: string; b?: true; i?: true }
  /** Reference to a printed page number of the same book ("patrz str. 45"). */
  | { page: number };

export type WarningKind = "danger" | "warning" | "caution" | "note";

export interface HeadingBlock {
  type: "heading";
  id: string;
  /** 2 = top-level heading inside a section page, 3..4 = deeper. */
  level: 2 | 3 | 4;
  runs: Run[];
  page?: number;
}

export interface ParagraphBlock {
  type: "paragraph";
  id: string;
  runs: Run[];
  page?: number;
}

export interface ListBlock {
  type: "list";
  id: string;
  ordered: boolean;
  items: Run[][];
  page?: number;
}

export interface WarningBlock {
  type: "warning";
  id: string;
  kind: WarningKind;
  /** Original Polish label, e.g. "Ostrzeżenie", "Przestroga", "Uwaga". */
  title: string;
  blocks: Array<ParagraphBlock | ListBlock>;
  page?: number;
}

export interface TableBlock {
  type: "table";
  id: string;
  /** First row is the header when `header` is true. */
  header: boolean;
  rows: string[][];
  page?: number;
}

export interface ImageBlock {
  type: "image";
  id: string;
  /** Public URL, e.g. `/assets/manual/kluczyki-drzwi-i-szyby/p021-01.webp`. */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Small pictograms (e.g. control indicators) rendered inline-sized. */
  icon?: boolean;
  page?: number;
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | WarningBlock
  | TableBlock
  | ImageBlock;

/** One node of the table of contents. Every node is a readable page. */
export interface SectionMeta {
  /** Unique within the book: slug path joined with "/". */
  id: string;
  slug: string[];
  title: string;
  /** 1 = chapter. */
  level: number;
  parentId: string | null;
  /** Printed page number where the section starts (if known). */
  page: number | null;
  /** Chapter file (relative to the book directory) holding the blocks. */
  file: string;
}

export interface BookIndex {
  formatVersion: number;
  id: BookId;
  title: string;
  /** True for the committed placeholder shown before `npm run extract`. */
  placeholder?: boolean;
  source: {
    url: string;
    file: string;
    extractedAt: string | null;
    pages: number | null;
  };
  /** Flat list in reading order (depth-first). */
  sections: SectionMeta[];
}

export interface ChapterFile {
  formatVersion: number;
  /** Blocks keyed by section id. */
  sections: Record<string, Block[]>;
}
