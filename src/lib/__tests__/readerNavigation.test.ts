import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeReaderTrail,
  goReaderBack,
  previousReaderEntry,
  readerCar,
  recordReaderPage,
} from "@/lib/readerNavigation";

const first = "/auto/car/manual/wprowadzenie";
const second = "/auto/car/manual/kluczyki";
const third = "/auto/car/other/radio";
const bookIndex = "/auto/car/manual";
const otherIndex = "/auto/car/other";
const empty = { pages: [], pending: null, floor: -1 };

describe("reader back navigation", () => {
  it("recognizes manual routes, not equipment and other car tools", () => {
    expect(readerCar(first)).toBe("car");
    expect(readerCar("/auto/car/wyposazenie")).toBeNull();
    expect(readerCar("/auto/car/dane-techniczne")).toBeNull();
    expect(readerCar("/auto/car")).toBeNull();
  });
  it("consumes previous reader pages across books without adding a back loop", () => {
    let trail = recordReaderPage(
      recordReaderPage(recordReaderPage(empty, first), second),
      third,
    );
    const back = consumeReaderTrail(trail, third, otherIndex);
    expect(back.target).toBe(second);
    trail = recordReaderPage(back.trail, second);
    expect(trail.pages).toEqual([first, second]);
    expect(consumeReaderTrail(trail, second, bookIndex).target).toBe(first);
  });
  it("falls back to the current book index, not the first book or a category, then car home", () => {
    const back = consumeReaderTrail(
      recordReaderPage(empty, third),
      third,
      otherIndex,
    );
    expect(back.target).toBe(otherIndex);
    expect(
      consumeReaderTrail(
        recordReaderPage(back.trail, otherIndex),
        otherIndex,
        otherIndex,
      ).target,
    ).toBe("/auto/car");
  });
  it("opens the book index even from the first category without previous pages", () => {
    expect(
      consumeReaderTrail(recordReaderPage(empty, first), first, bookIndex)
        .target,
    ).toBe(bookIndex);
  });
  it("goes straight to car home from the book index without previous pages", () => {
    expect(
      consumeReaderTrail(
        recordReaderPage(empty, bookIndex),
        bookIndex,
        bookIndex,
      ).target,
    ).toBe("/auto/car");
  });
  it("skips non-reader pages, other cars and anchors on the same reader page", () => {
    expect(
      previousReaderEntry(
        [
          { index: 1, path: first },
          { index: 2, path: "/auto/car" },
          { index: 3, path: "/auto/other/manual/intro" },
          { index: 4, path: second },
          { index: 5, path: second },
        ],
        5,
        second,
        -1,
      ),
    ).toEqual({ index: 1, path: first });
  });
  it("does not revisit exhausted history before the book-index fallback", () => {
    expect(
      previousReaderEntry(
        [
          { index: 1, path: third },
          { index: 2, path: otherIndex },
        ],
        2,
        otherIndex,
        2,
      ),
    ).toBeNull();
  });
});

describe("native reader history fallback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens the current book index after exhaustion and sets a no-loop boundary", () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    const navigation = {
      currentEntry: { index: 0 },
      entries: () => [
        { index: 0, url: `http://localhost${third}` },
        { index: 1, url: `http://localhost${otherIndex}` },
      ],
    };
    const go = vi.fn();
    vi.stubGlobal("window", {
      navigation,
      location: { origin: "http://localhost" },
      history: { go },
    });

    expect(goReaderBack(third, otherIndex)).toBe(otherIndex);
    navigation.currentEntry.index = 1;
    expect(goReaderBack(otherIndex, otherIndex)).toBe("/auto/car");
    expect(go).not.toHaveBeenCalled();
  });
});
