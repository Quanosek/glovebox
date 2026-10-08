// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { containerText, offsetOf, offsetsOfRange, rangeFromOffsets } from "@/lib/anchoring/dom";

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `
    <article id="root">
      <h2>Kluczyki <span data-anchor-ignore>Twoje auto</span></h2>
      <p>Nacisnąć <strong>przycisk</strong> na pilocie.</p>
    </article>`;
  root = document.getElementById("root")!;
});

describe("anchoring/dom", () => {
  it("skips ignored elements in container text", () => {
    const text = containerText(root);
    expect(text).not.toContain("Twoje auto");
    expect(text).toContain("Nacisnąć przycisk na pilocie.");
  });

  it("round-trips offsets through DOM ranges", () => {
    const text = containerText(root);
    const start = text.indexOf("przycisk na");
    const end = start + "przycisk na".length;
    const range = rangeFromOffsets(root, start, end)!;
    expect(range.toString()).toBe("przycisk na");
    expect(offsetsOfRange(root, range)).toEqual({ start, end });
  });

  it("handles element boundary points", () => {
    const p = root.querySelector("p")!;
    const text = containerText(root);
    expect(offsetOf(root, p, 1)).toBe(text.indexOf("przycisk"));
    expect(offsetOf(root, p, p.childNodes.length)).toBe(text.indexOf(" na pilocie.") + " na pilocie.".length);
  });

  it("returns null for nodes outside the container", () => {
    const outside = document.createTextNode("x");
    document.body.appendChild(outside);
    expect(offsetOf(root, outside, 0)).toBeNull();
  });
});
