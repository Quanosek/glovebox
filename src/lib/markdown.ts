/**
 * Minimal, safe Markdown parser for the notebook. Produces a small AST that
 * is rendered as React elements (no HTML strings, so no injection).
 *
 * Supported: `#`–`###` headings, paragraphs (single newlines = line breaks),
 * `-`/`*`/`+` and `1.` lists, task items `- [ ]` / `- [x]`, `>` quotes,
 * fenced code blocks, `---` rules and inline `**bold**`, `*italic*`,
 * `_italic_`, `~~strike~~`, `` `code` `` and `[links](https://…)`.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "strong" | "em" | "del"; children: Inline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: Inline[] };

export interface ListItem {
  children: Inline[];
  /** Task list state (`- [ ]` / `- [x]`), undefined for plain items. */
  checked?: boolean;
}

export type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "quote"; children: MdBlock[] }
  | { type: "code"; value: string }
  | { type: "hr" };

const INLINE_RE =
  /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*([^*\s](?:[^*\n]*[^*\s])?)\*|(?<![\p{L}\p{N}])_([^_\s](?:[^_\n]*[^_\s])?)_(?![\p{L}\p{N}])/gu;

/** Only harmless link targets are kept; others render as plain text. */
export function safeHref(href: string): string | null {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href) ? href : null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (last?.type === "text") last.value += value;
    else out.push({ type: "text", value });
  };
  let pos = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const index = m.index ?? 0;
    pushText(text.slice(pos, index));
    pos = index + m[0].length;
    if (m[1] !== undefined) out.push({ type: "code", value: m[1] });
    else if (m[2] !== undefined) {
      const href = safeHref(m[3]);
      if (href) out.push({ type: "link", href, children: parseInline(m[2]) });
      else pushText(m[0]);
    } else if (m[4] !== undefined || m[5] !== undefined)
      out.push({ type: "strong", children: parseInline(m[4] ?? m[5]) });
    else if (m[6] !== undefined)
      out.push({ type: "del", children: parseInline(m[6]) });
    else out.push({ type: "em", children: parseInline(m[7] ?? m[8]) });
  }
  pushText(text.slice(pos));
  return out;
}

const HEADING = /^(#{1,3})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const UL = /^\s{0,3}[-*+]\s+(.*)$/;
const OL = /^\s{0,3}\d{1,9}[.)]\s+(.*)$/;
const FENCE = /^\s{0,3}```/;
const TASK = /^\[([ xX])\]\s+(.*)$/;

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({
        type: "paragraph",
        children: parseInline(para.join("\n")),
      });
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      blocks.push({ type: "code", value: code.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        children: parseInline(heading[2]),
      });
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }
    if (QUOTE.test(line)) {
      flush();
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]))
        inner.push(QUOTE.exec(lines[i++])![1]);
      i--;
      blocks.push({ type: "quote", children: parseMarkdown(inner.join("\n")) });
      continue;
    }
    const ordered = OL.test(line);
    if (ordered || UL.test(line)) {
      flush();
      const re = ordered ? OL : UL;
      const items: ListItem[] = [];
      while (i < lines.length && re.test(lines[i])) {
        const text = re.exec(lines[i++])![1];
        const task = TASK.exec(text);
        items.push(
          task
            ? { children: parseInline(task[2]), checked: task[1] !== " " }
            : { children: parseInline(text) },
        );
      }
      i--;
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Plain-text excerpt of Markdown (for lists and previews). */
export function markdownToText(source: string): string {
  const inline = (nodes: Inline[]): string =>
    nodes
      .map((n) =>
        n.type === "text" || n.type === "code" ? n.value : inline(n.children),
      )
      .join("");
  const block = (b: MdBlock): string => {
    switch (b.type) {
      case "heading":
      case "paragraph":
        return inline(b.children);
      case "list":
        return b.items.map((it) => inline(it.children)).join(" · ");
      case "quote":
        return b.children.map(block).join(" ");
      case "code":
        return b.value;
      case "hr":
        return "";
    }
  };
  return parseMarkdown(source)
    .map(block)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------ editor helpers */

export interface EditResult {
  value: string;
  start: number;
  end: number;
}

/** Wraps the selection with `before`/`after` (or removes an existing wrap). */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after = before,
  placeholder = "tekst",
): EditResult {
  const selected = value.slice(start, end);
  if (
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after
  ) {
    return {
      value:
        value.slice(0, start - before.length) +
        selected +
        value.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    };
  }
  const inner = selected || placeholder;
  return {
    value: value.slice(0, start) + before + inner + after + value.slice(end),
    start: start + before.length,
    end: start + before.length + inner.length,
  };
}

/**
 * Toggles a line prefix (`## `, `- `, `> `…) on every line touched by the
 * selection. `prefix` may contain `{n}` for numbered lists.
 */
export function toggleLinePrefix(
  value: string,
  start: number,
  end: number,
  prefix: string,
): EditResult {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf(
    "\n",
    Math.max(end - (end > start ? 1 : 0), start),
  );
  if (lineEnd === -1) lineEnd = value.length;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const pattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\{n\\}", "\\d+")}`,
  );
  const allPrefixed = lines.every((l) => pattern.test(l));
  const next = lines.map((l, i) =>
    allPrefixed
      ? l.replace(pattern, "")
      : prefix.replace("{n}", String(i + 1)) + l,
  );
  const replaced = next.join("\n");
  return {
    value: value.slice(0, lineStart) + replaced + value.slice(lineEnd),
    start: lineStart,
    end: lineStart + replaced.length,
  };
}
