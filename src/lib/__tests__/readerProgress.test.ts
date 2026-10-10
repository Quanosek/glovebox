import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionOutline } from "@/components/reader/SectionOutline";
import {
  activeReaderHeading,
  readerOutlineProgress,
  readerOutlineScrollTop,
} from "@/lib/readerProgress";

describe("reader outline progress", () => {
  it("preserves heading hierarchy for permanent styling independent of selection", () => {
    const html = renderToStaticMarkup(
      createElement(SectionOutline, {
        headings: [
          { id: "b1", label: "Główny nagłówek", level: 2 },
          { id: "b2", label: "Podkategoria", level: 3 },
        ],
      }),
    );
    expect(html).toContain('href="#b1" data-level="2"');
    expect(html).toContain('href="#b2" data-level="3"');
    expect(html).not.toContain("aria-current");
  });
  it("requires exactly one third of the readable viewport for a long section", () => {
    expect(
      activeReaderHeading([{ id: "a", top: 701, bottom: 1600 }], 100, 1000),
    ).toBeNull();
    expect(
      activeReaderHeading([{ id: "a", top: 700, bottom: 1600 }], 100, 1000),
    ).toBe("a");
  });

  describe("stepped outline progress", () => {
    it("starts empty and fills exactly through the active link, including wrapped labels", () => {
      expect(readerOutlineProgress(null, 200)).toBe(0);
      expect(readerOutlineProgress(40, 200)).toBe(0.2);
      expect(readerOutlineProgress(120, 200)).toBe(0.6);
    });
    it("clamps the fill to its track and keeps a hidden outline empty", () => {
      expect(readerOutlineProgress(-10, 200)).toBe(0);
      expect(readerOutlineProgress(250, 200)).toBe(1);
      expect(readerOutlineProgress(40, 0)).toBe(0);
    });
    it("fills completely only through the selected final link, never independently of the selection", () => {
      expect(readerOutlineProgress(200, 200)).toBe(1);
      expect(readerOutlineProgress(120, 200)).toBe(0.6);
      expect(readerOutlineProgress(null, 200)).toBe(0);
    });
  });

  describe("outline scroll context", () => {
    const pane = { scrollTop: 200, height: 600, scrollHeight: 1600 };
    it("keeps the active heading away from the upper and lower edges", () => {
      expect(readerOutlineScrollTop({ ...pane, top: 250, bottom: 280 })).toBe(
        154,
      );
      expect(readerOutlineScrollTop({ ...pane, top: 720, bottom: 750 })).toBe(
        246,
      );
      expect(readerOutlineScrollTop({ ...pane, top: 400, bottom: 430 })).toBe(
        200,
      );
    });
    it("clamps at the first heading and reveals padding at the end", () => {
      expect(readerOutlineScrollTop({ ...pane, top: 20, bottom: 50 })).toBe(0);
      expect(readerOutlineScrollTop({ ...pane, top: 1500, bottom: 1552 })).toBe(
        1000,
      );
    });
    it("leaves proportionate context in a short pane without scrolling short lists", () => {
      expect(
        readerOutlineScrollTop({ ...pane, height: 200, top: 370, bottom: 400 }),
      ).toBe(250);
      expect(
        readerOutlineScrollTop({
          ...pane,
          scrollTop: 0,
          scrollHeight: 300,
          top: 10,
          bottom: 30,
        }),
      ).toBe(0);
    });
  });
  it("does not require a heading itself to remain visible inside a long section", () => {
    expect(
      activeReaderHeading([{ id: "a", top: -2000, bottom: 2000 }], 100, 1000),
    ).toBe("a");
  });
  it("selects the final short part when the content end is visible, even if the previous part occupies more space", () => {
    expect(
      activeReaderHeading(
        [
          { id: "previous", top: -500, bottom: 850 },
          { id: "last", top: 850, bottom: 950 },
        ],
        100,
        1000,
      ),
    ).toBe("last");
  });
  it("switches to the final heading exactly at the content end and restores the previous selection on upward scroll", () => {
    const sections = [
      { id: "previous", top: -500, bottom: 900 },
      { id: "last", top: 900, bottom: 1000 },
    ];
    const offset = (amount: number) =>
      sections.map((section) => ({
        ...section,
        top: section.top + amount,
        bottom: section.bottom + amount,
      }));
    expect(activeReaderHeading(offset(1), 100, 1000)).toBe("previous");
    expect(activeReaderHeading(sections, 100, 1000)).toBe("last");
    expect(activeReaderHeading(offset(-1000), 100, 1000)).toBe("last");
    expect(activeReaderHeading(offset(1), 100, 1000)).toBe("previous");
  });
  it("follows the most visible section when scrolling forward or backward", () => {
    const sections = [
      { id: "a", top: -500, bottom: 500 },
      { id: "b", top: 500, bottom: 1800 },
    ];
    expect(activeReaderHeading(sections, 100, 1000)).toBe("b");
    expect(
      activeReaderHeading(
        sections.map((s) => ({
          ...s,
          top: s.top + 200,
          bottom: s.bottom + 200,
        })),
        100,
        1000,
      ),
    ).toBe("a");
  });
  it("uses the upper-third reading line to break equal coverage ties", () => {
    expect(
      activeReaderHeading(
        [
          { id: "a", top: -500, bottom: 550 },
          { id: "b", top: 550, bottom: 1800 },
        ],
        100,
        1000,
      ),
    ).toBe("a");
  });
  it("allows short parts only when they are fully visible", () => {
    const next = { id: "b", top: 999, bottom: 2000 };
    expect(
      activeReaderHeading(
        [{ id: "a", top: 200, bottom: 300 }, next],
        100,
        1000,
      ),
    ).toBe("a");
    expect(
      activeReaderHeading([{ id: "a", top: 50, bottom: 150 }, next], 100, 1000),
    ).toBeNull();
  });
  it("clears selection before the first heading and keeps the final heading after the content", () => {
    expect(
      activeReaderHeading([{ id: "a", top: 1200, bottom: 1400 }], 100, 1000),
    ).toBeNull();
    expect(
      activeReaderHeading([{ id: "a", top: -500, bottom: 50 }], 100, 1000),
    ).toBe("a");
    expect(activeReaderHeading([], 100, 1000)).toBeNull();
    expect(
      activeReaderHeading([{ id: "a", top: 0, bottom: 1000 }], 1000, 1000),
    ).toBeNull();
  });
});
