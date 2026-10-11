"""Dot leaders: chapter tables of contents (skipped) and legends of
illustrations (turned into page references)."""

from __future__ import annotations

import re

from .document import Document
from .model import Item, Span
from .text import LEADER_DOTS, LEADER_RE, REF_MARK, clean_text

LEADER_TAIL_RE = re.compile(r"(?<=\S)\s+" + LEADER_DOTS + r"\s*$")


def merge_leader_numbers(lines: list[Item]) -> list[Item]:
    """Join separately drawn page numbers before column detection."""
    dropped: set[int] = set()
    for line in lines:
        if not LEADER_TAIL_RE.search(line.text):
            continue
        candidates = [
            other for other in lines
            if other is not line and id(other) not in dropped
            and other.page == line.page
            and re.fullmatch(r"\d{1,3}", other.text.strip())
            and abs(other.base - line.base) < max(1.0, line.size * 0.2)
            and 0 <= other.x0 - line.x1 <= line.size * 5
        ]
        if not candidates:
            continue
        number = min(candidates, key=lambda other: other.x0)
        left_xs, right_xs = line.data.get("char_x"), number.data.get("char_x")
        if left_xs is not None and right_xs is not None and len(left_xs) == len(line.text) and len(right_xs) == len(number.text):
            line.data["char_x"] = left_xs + [line.x1] + right_xs
        else:
            line.data.pop("char_x", None)
        line.spans += [Span(" ", False, False, line.size, "", None)] + [span.copy() for span in number.spans]
        line.bbox = (line.x0, min(line.y0, number.y0), number.x1, max(line.y1, number.y1))
        line.data["line_x"] = (line.x0, line.x1)
        dropped.add(id(number))
    return [line for line in lines if id(line) not in dropped]


def mark_toc_lines(doc: Document, start: int, end: int) -> None:
    """Mark a chapter table of contents ("Kluczyki ........ 22") inside
    the items of one outline entry, including the first lines of
    multi-line entries. Numbered legends of illustrations ("23 Sygnał
    dźwiękowy .... 85") are content and stay."""
    legend_pages = {it.page for it in doc.items if it.data.get("legend")}
    lines = [k for k in range(start, end) if doc.items[k].kind == "line" and doc.items[k].page not in legend_pages]
    leaders = [k for k in lines if doc.items[k].data.get("leader") and not re.match(r"\d", clean_text(doc.items[k].text))]
    if len(leaders) < 3 or len(leaders) < len(lines) * 0.4:
        return
    marked = set(leaders)
    for k in sorted(lines, reverse=True):
        it = doc.items[k]
        if it.data.get("toc"):
            continue
        if k in marked:
            it.data["toc"] = True
            continue
        nxt = doc.items[k + 1] if k + 1 < len(doc.items) else None
        if (
            nxt is not None
            and nxt.data.get("toc")
            and nxt.page == it.page
            and nxt.col == it.col
            and 0 < nxt.base - it.base <= doc.body_size * 1.5
            and it.size <= doc.body_size * 1.05
        ):
            it.data["toc"] = True


def leaders_to_refs(doc: Document) -> None:
    """"Sygnał dźwiękowy ........ 85" -> "Sygnał dźwiękowy ⇒ 85"."""
    for it in doc.items:
        if it.kind != "line" or not LEADER_RE.search(it.text):
            continue
        it.data["leader"] = True
        for s in it.spans:
            s.text = re.sub(r"(?<![\d.…\s])\s*" + LEADER_DOTS + r"\s*(?=\d{1,3}\s*$|$)", f" {REF_MARK} ", s.text)
