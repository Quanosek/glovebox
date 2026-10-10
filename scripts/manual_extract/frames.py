"""Boxes drawn around warnings and the warning labels that start them."""

from __future__ import annotations

from typing import Any

from .document import Document
from .geometry import center, contains
from .model import Item, Span
from .pdf import pymupdf
from .text import REF_MARK, WARNING_LABELS, clean_text


def page_frames(doc: Document, pno: int) -> list[Any]:
    """Boxes drawn around warnings: stroked rectangles or pairs of vertical
    lines joined by a horizontal one (a box broken across columns or pages
    is open at the top or at the bottom)."""
    if pno in doc.frames:
        return doc.frames[pno]
    page = doc.pdf[pno]
    horizontals = doc.horizontal_rules(pno)
    verticals: list[tuple[float, float, float]] = []
    frames: list[Any] = []
    for d in doc.drawings(page):
        for op in d["items"]:
            if op[0] == "l":
                a, b = op[1], op[2]
                if abs(a.x - b.x) < 0.8 and abs(a.y - b.y) >= 12:
                    verticals.append(((a.x + b.x) / 2, min(a.y, b.y), max(a.y, b.y)))
            elif op[0] == "re" and d.get("color") is not None and d.get("type") in ("s", "fs"):
                r = pymupdf.Rect(op[1])
                if r.width >= 50 and r.height >= 14:
                    frames.append(r)
    verticals.sort()
    merged: list[tuple[float, float, float]] = []
    for x, y0, y1 in verticals:
        if merged and abs(merged[-1][0] - x) < 0.8 and y0 <= merged[-1][2] + 1.5:
            merged[-1] = (merged[-1][0], merged[-1][1], max(merged[-1][2], y1))
        else:
            merged.append((x, y0, y1))
    width = page.rect.width
    for i, (xa, a0, a1) in enumerate(merged):
        for xb, b0, b1 in merged[i + 1 :]:
            if xb - xa < 40 or xb - xa > width * 0.95 or abs(a0 - b0) > 2 or abs(a1 - b1) > 2:
                continue
            y0, y1 = min(a0, b0), max(a1, b1)
            if any(
                abs(h[0] - xa) < 2.5 and abs(h[2] - xb) < 2.5 and (abs(h[1] - y0) < 2.5 or abs(h[1] - y1) < 2.5)
                for h in horizontals
            ):
                frames.append(pymupdf.Rect(xa, y0, xb, y1))
                break
    doc.frames[pno] = frames
    return frames


def assign_frames(doc: Document, pno: int, lines: list[Item]) -> None:
    frames = page_frames(doc, pno)
    if not frames:
        return
    for ln in lines:
        c = center(ln.bbox)
        inside = [k for k, f in enumerate(frames) if contains((f.x0 - 1, f.y0 - 1, f.x1 + 1, f.y1 + 1), c)]
        if not inside:
            continue
        k = min(inside, key=lambda k: frames[k].width * frames[k].height)
        ln.data["frame"] = (pno, k)
        if warning_label_of(ln) is not None:
            doc.labeled_frames.add((pno, k))


def warning_label_of(it: Item) -> tuple[str, str, list[Span]] | None:
    """(kind, Polish title, remaining spans) when the line starts a warning."""
    spans = [s for s in it.spans if not s.icon]
    text = clean_text("".join(s.text for s in spans).replace(REF_MARK, ""))
    if not text[:1].isupper():
        return None  # "…wyświetla się następująca / informacja:" continues a sentence
    key = text.lower().rstrip(":").strip()
    if key in WARNING_LABELS:
        kind, title = WARNING_LABELS[key]
        return kind, title, []
    first = next((s for s in spans if s.text.strip()), None)
    if first and first.bold:
        head = first.text.strip().lower().rstrip(":")
        if head in WARNING_LABELS and len(text) > len(head) + 1:
            kind, title = WARNING_LABELS[head]
            idx = spans.index(first)
            return kind, title, spans[idx + 1 :]
    return None
