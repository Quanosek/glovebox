"""Dot leaders: chapter tables of contents (skipped) and legends of
illustrations (turned into page references)."""

from __future__ import annotations

import re

from .document import Document
from .text import LEADER_DOTS, LEADER_RE, REF_MARK, clean_text


def mark_toc_lines(doc: Document, start: int, end: int) -> None:
    """Mark a chapter table of contents ("Kluczyki ........ 22") inside
    the items of one outline entry, including the first lines of
    multi-line entries. Numbered legends of illustrations ("23 Sygnał
    dźwiękowy .... 85") are content and stay."""
    lines = [k for k in range(start, end) if doc.items[k].kind == "line"]
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
