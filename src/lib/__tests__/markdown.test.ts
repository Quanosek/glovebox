import { describe, expect, it } from "vitest";
import {
  markdownToText,
  parseInline,
  parseMarkdown,
  safeHref,
  toggleLinePrefix,
  wrapSelection,
} from "@/lib/markdown";

describe("parseInline", () => {
  it("parses emphasis, code and links", () => {
    expect(parseInline("a **b** *c* ~~d~~ `e` [f](https://x.pl)")).toEqual([
      { type: "text", value: "a " },
      { type: "strong", children: [{ type: "text", value: "b" }] },
      { type: "text", value: " " },
      { type: "em", children: [{ type: "text", value: "c" }] },
      { type: "text", value: " " },
      { type: "del", children: [{ type: "text", value: "d" }] },
      { type: "text", value: " " },
      { type: "code", value: "e" },
      { type: "text", value: " " },
      {
        type: "link",
        href: "https://x.pl",
        children: [{ type: "text", value: "f" }],
      },
    ]);
  });

  it("keeps unsafe links as text", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { type: "text", value: "[x](javascript:alert(1))" },
    ]);
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("/auto/x")).toBe("/auto/x");
  });

  it("does not treat snake_case as italics", () => {
    expect(parseInline("tyre_pressure_kit")).toEqual([
      { type: "text", value: "tyre_pressure_kit" },
    ]);
  });
});

describe("parseMarkdown", () => {
  it("parses block structure", () => {
    const md = [
      "# Tytuł",
      "Linia 1",
      "linia 2",
      "",
      "- a",
      "- [x] zrobione",
      "1. jeden",
      "2. dwa",
      "> cytat",
      "---",
      "```",
      "**nie pogrubione**",
      "```",
    ].join("\n");
    const blocks = parseMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "list",
      "quote",
      "hr",
      "code",
    ]);
    expect(blocks[1]).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "Linia 1\nlinia 2" }],
    });
    const ul = blocks[2] as Extract<(typeof blocks)[number], { type: "list" }>;
    expect(ul.ordered).toBe(false);
    expect(ul.items[1].checked).toBe(true);
    expect(blocks[6]).toEqual({ type: "code", value: "**nie pogrubione**" });
  });

  it("produces plain text excerpts", () => {
    expect(markdownToText("## Olej\n\n- **5W-30**\n- 4,5 l")).toBe(
      "Olej 5W-30 · 4,5 l",
    );
  });
});

describe("editor helpers", () => {
  it("wraps and unwraps the selection", () => {
    const wrapped = wrapSelection("ab cd", 3, 5, "**");
    expect(wrapped).toEqual({ value: "ab **cd**", start: 5, end: 7 });
    expect(
      wrapSelection(wrapped.value, wrapped.start, wrapped.end, "**"),
    ).toEqual({ value: "ab cd", start: 3, end: 5 });
  });

  it("inserts a placeholder for an empty selection", () => {
    expect(wrapSelection("", 0, 0, "*")).toEqual({
      value: "*tekst*",
      start: 1,
      end: 6,
    });
  });

  it("toggles line prefixes", () => {
    const r = toggleLinePrefix("a\nb\nc", 0, 3, "{n}. ");
    expect(r.value).toBe("1. a\n2. b\nc");
    expect(toggleLinePrefix(r.value, r.start, r.end, "{n}. ").value).toBe(
      "a\nb\nc",
    );
    expect(toggleLinePrefix("x\ny", 2, 2, "> ").value).toBe("x\n> y");
  });
});
