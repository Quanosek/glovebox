import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContinueReading } from "@/components/ContinueReading";
import { EMPTY_HINT } from "@/lib/storage/hint";
import { useLayoutHint } from "@/lib/storage/hintContext";

vi.mock("@/lib/storage/hintContext", () => ({
  useLayoutHint: vi.fn(),
}));

describe("continue reading layout", () => {
  it.each([null, "/media/car/manual/chapter/p1-1.webp"])(
    "stacks only on phones, with thumbnail %s",
    (thumb) => {
      vi.mocked(useLayoutHint).mockReturnValue({
        ...EMPTY_HINT,
        lastRead: {
          car: "car",
          title: "Kontrola poziomu oleju",
          href: "/auto/car/manual/kontrola",
          when: "26.10.2026",
          thumb,
        },
      });
      const html = renderToStaticMarkup(createElement(ContinueReading));
      expect(html).toContain("flex-col items-stretch");
      expect(html).toContain("sm:flex-row sm:items-center");
      expect(html).toContain("w-full justify-center sm:w-auto sm:shrink-0");
      expect(html).toContain('href="/auto/car/manual/kontrola"');
      expect(html.includes("<img")).toBe(thumb !== null);
    },
  );
});
