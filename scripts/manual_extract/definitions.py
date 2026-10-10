"""Definition lists inside a column ("W dół  : opuszczanie siedziska",
older manuals: "HI  = praca szybka")."""

from __future__ import annotations

import re

from .document import Document
from .model import Item, Span
from .text import clean_text, join_line_texts


def merge_definitions(doc: Document) -> None:
    """Two-column definition lists inside a column ("W dół  : opuszczanie
    siedziska", the description aligned on its colon) become single
    items flagged as list entries."""
    groups_by_key: dict[tuple[int, int, int], list[Item]] = {}
    for it in doc.items:
        if it.kind == "line" and it.col >= 0:
            groups_by_key.setdefault((it.page, it.col, it.band), []).append(it)
    replace: dict[int, Item] = {}
    drop: set[int] = set()
    for lines in groups_by_key.values():
        lines.sort(key=lambda i: (i.base, i.x0))
        colon_rows = [
            c for c in lines
            if clean_text(c.plain)[:1] in (":", "=")
            and any(o is not c and abs(o.base - c.base) < 2 and o.x1 <= c.x0 + 1 for o in lines)
        ]
        groups: list[list[Item]] = []
        for c in colon_rows:
            if groups and abs(groups[-1][-1].x0 - c.x0) < 4 and c.base - groups[-1][-1].base < doc.pitch * 6:
                groups[-1].append(c)
            else:
                groups.append([c])
        for g in groups:
            cx = g[0].x0
            for k, c in enumerate(g):
                hi = g[k + 1].base - 1 if k + 1 < len(g) else None
                row: list[Item] = []
                last = c.base
                for ln in lines:
                    if id(ln) in drop or ln.base < c.base - 1 or (hi is not None and ln.base >= hi):
                        continue
                    if hi is None and ln.base - last > doc.pitch * 1.5:
                        break
                    if ln.x1 <= cx + 1 or ln.x0 >= cx - 2:
                        row.append(ln)
                        last = max(last, ln.base)
                term = [ln for ln in row if ln.x1 <= cx + 1]
                desc = [ln for ln in row if ln.x0 >= cx - 2]
                if not term or not desc:
                    continue
                merged = concat_lines(term)
                body = concat_lines(desc)
                for s in body:
                    if s.text.strip():
                        s.text = re.sub(r"^\s*[:=]\s*", "", s.text)
                        break
                first = min(row, key=lambda i: (i.base, i.x0))
                item = Item(
                    "line", c.page,
                    (min(i.x0 for i in row), min(i.y0 for i in row), max(i.x1 for i in row), max(i.y1 for i in row)),
                    c.col, c.band, merged + [Span(separator(c), False, False, c.size, "")] + body,
                    {**first.data, "defitem": True}, c.base,
                )
                replace[id(first)] = item
                drop.update(id(i) for i in row if i is not first)
        for g in groups:
            # "do przodu/do tyłu: regulacja" right above the aligned rows
            # is the first entry of the same list.
            above = [ln for ln in lines if id(ln) not in drop and 0 < g[0].base - ln.base <= doc.pitch * 1.5]
            if len(above) == 1 and re.match(r"^[^:=]{1,30}\s?[:=]\s+\S", clean_text(above[0].plain)):
                above[0].data["defitem"] = True
    if not replace:
        return
    doc.items = [replace.get(id(it), it) for it in doc.items if id(it) not in drop]


def concat_lines(lines: list[Item]) -> list[Span]:
    """Spans of several lines read as one text (de-hyphenated)."""
    out: list[Span] = []
    for ln in sorted(lines, key=lambda i: (round(i.base), i.x0)):
        spans = [Span(s.text, s.bold, s.italic, s.size, s.font, s.bbox, s.icon, s.color) for s in ln.spans]
        if out:
            text = "".join(s.text for s in out)
            fixed, sep = join_line_texts(text, "".join(s.text for s in spans))
            cut = len(text) - len(fixed)
            while cut > 0 and out:
                take = min(cut, len(out[-1].text))
                out[-1].text = out[-1].text[: len(out[-1].text) - take]
                cut -= take
                if not out[-1].text:
                    out.pop()
            if sep:
                out.append(Span(sep, False, False, ln.size, ""))
            if spans:
                spans[0].text = spans[0].text.lstrip()
        out.extend(spans)
    return out


def separator(colon_line: Item) -> str:
    """": " for "term : description", " = " for "term = description"."""
    return " = " if clean_text(colon_line.plain).startswith("=") else ": "
