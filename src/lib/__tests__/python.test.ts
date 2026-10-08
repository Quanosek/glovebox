import { describe, expect, it } from "vitest";
import { isSupportedPython } from "@/lib/server/python";

describe("isSupportedPython", () => {
  it("accepts versions listed in scripts/requirements.txt and the README", () => {
    expect(
      isSupportedPython({
        command: "python3",
        version: "3.10.0",
        pymupdf: "1.26.0",
        pillow: "12.3.0",
      }),
    ).toBe(true);
  });

  it("rejects missing or older dependencies", () => {
    expect(
      isSupportedPython({
        command: "python3",
        version: "3.9.9",
        pymupdf: "1.25.9",
        pillow: null,
      }),
    ).toBe(false);
  });
});
