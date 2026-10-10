import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTENT_FORMAT_VERSION } from "@/content/types";
import { documentTitle, formatDecimal, formatFileSize } from "@/lib/files";

describe("manual files", () => {
  it("derives a readable title from a PDF file name", () => {
    expect(documentTitle("instrukcja_cascada__0815_my16.PDF")).toBe(
      "instrukcja cascada 0815 my16",
    );
    expect(documentTitle("  ARONA 06 23 PL.pdf ")).toBe("ARONA 06 23 PL");
  });

  it("formats sizes and decimals in Polish notation", () => {
    expect(formatFileSize(1536 * 1024)).toBe("1,5 MB");
    expect(formatFileSize(840 * 1024)).toBe("840 kB");
    expect(formatFileSize(10)).toBe("1 kB");
    expect(formatDecimal(1.598)).toBe("1,6");
    expect(formatDecimal(2, 2)).toBe("2,00");
  });

  it("keeps the content format of the extractor and the reader in step", () => {
    const build = readFileSync("scripts/manual_extract/build.py", "utf8");
    const version = Number(/^FORMAT_VERSION = (\d+)$/m.exec(build)?.[1]);
    expect(version).toBe(CONTENT_FORMAT_VERSION);
  });
});
