import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CarFile } from "@/lib/cars";
import type { BookIndex, ChapterFile, SectionMeta } from "@/content/types";

/**
 * Synthetic manual database written to a temporary folder for tests (the
 * real `database/` is user data and never holds fixtures). Point
 * `MANUALS_DATABASE_DIR` at `root` before calling the content reader.
 */
export interface TestDatabase {
  root: string;
  write(relative: string, value: unknown): string;
  remove(): void;
}

export function createDatabase(): TestDatabase {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "glovebox-db-"));
  return {
    root,
    write(relative, value) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file,
        typeof value === "string" || Buffer.isBuffer(value)
          ? value
          : JSON.stringify(value),
      );
      return file;
    },
    remove() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

export function carFile(
  id: string,
  books: string[],
  extra: Partial<CarFile> = {},
): CarFile {
  return {
    formatVersion: 1,
    id,
    brand: "Testowa",
    model: "Model",
    year: 2020,
    createdAt: "2026-01-01T00:00:00.000Z",
    books: books.map((book) => ({
      id: book,
      route: book,
      title: `Instrukcja ${book}`,
      short: book,
    })),
    ...extra,
  };
}

export function section(
  slug: string[],
  title: string,
  page: number,
  extra: Partial<SectionMeta> = {},
): SectionMeta {
  return {
    id: slug.join("/"),
    slug,
    title,
    level: slug.length,
    parentId: slug.length > 1 ? slug.slice(0, -1).join("/") : null,
    page,
    file: `${slug[0]}.json`,
    ...extra,
  };
}

export function bookIndex(
  id: string,
  sections: SectionMeta[],
  extra: Partial<BookIndex> = {},
): BookIndex {
  return {
    formatVersion: 1,
    id,
    title: `Instrukcja ${id}`,
    source: { url: "", file: `${id}.pdf`, extractedAt: null, pages: 40 },
    sections,
    ...extra,
  };
}

export function chapter(sections: ChapterFile["sections"]): ChapterFile {
  return { formatVersion: 1, sections };
}
