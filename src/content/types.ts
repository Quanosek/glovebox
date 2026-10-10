/**
 * Content model shared by the extraction scripts (`scripts/extract.py`)
 * and the reader. Generated JSON files in `src/content/<book>/` must match
 * these types. Generated files live in `database/<car>/<book>/`.
 * Bump `CONTENT_FORMAT_VERSION` when the shape changes.
 */

export const CONTENT_FORMAT_VERSION = 1;

/** Book id: lowercase slug, also the directory name inside the car folder. */
export type BookId = string;

/**
 * Inline text run. Plain strings are regular text; `href` marks an internet
 * address printed in the manual (opened as an external link).
 */
export type Run =
  | string
  | { t: string; b?: true; i?: true; href?: string }
  /** Reference to a printed page number of the same book ("patrz str. 45"). */
  | { page: number }
  /** Inline pictogram from the manual (button, warning lamp), shown at text size. */
  | { icon: string; w: number; h: number };

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
  /** Original PDF bullet glyphs and colours, aligned with `items`. */
  markers?: Array<{ glyph: string; color?: string } | null>;
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
  /**
   * Runs of every cell, aligned with `rows`, when some cell holds a
   * pictogram, a page reference or a link. `rows` keeps the plain text.
   */
  cells?: Run[][][];
  /**
   * Merged cells, aligned with `rows`: `[colspan, rowspan]` for a cell,
   * `null` for a position covered by a merged cell. Absent when none.
   */
  spans?: Array<Array<[number, number] | null>>;
  /** Number of header rows when `header` is true (default 1). */
  headerRows?: number;
  page?: number;
}

export interface ImageBlock {
  type: "image";
  id: string;
  /** URL, e.g. `/media/<car>/<book>/<section>/p021-01.webp`. */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Small pictograms (e.g. control indicators) rendered inline-sized. */
  icon?: boolean;
  /**
   * Width of the illustration as a share of the PDF page width (0–1); the
   * reader keeps illustrations of one book at the same scale.
   */
  share?: number;
  /** Caption printed under the illustration ("Rys. 45 Kluczyki samochodowe"). */
  caption?: Run[];
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
  /** True when the index has no extracted manual content. */
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
