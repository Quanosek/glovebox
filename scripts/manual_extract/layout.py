"""Reading order (any number of columns, full-width bands), line pitch and
paragraph edges."""

from __future__ import annotations

from collections import Counter

from .definitions import merge_definitions
from .document import Document
from .leaders import leaders_to_refs
from .model import Item


def assign_layout(doc: Document) -> None:
    by_page: dict[int, list[Item]] = {}
    for it in doc.items:
        by_page.setdefault(it.page, []).append(it)
    page_columns = {
        pno: [(0.0, doc.pdf[pno].rect.width)] if doc.args.single_column else find_columns(items, doc.pdf[pno].rect.width)
        for pno, items in by_page.items()
    }
    edges = common_edges(page_columns)
    ordered: list[Item] = []
    for pno in sorted(by_page):
        items = by_page[pno]
        columns = merge_indented_columns(page_columns[pno], edges)
        for it in items:
            it.col = -1
            for k, (c0, c1) in enumerate(columns):
                if it.x0 >= c0 - 3 and it.x1 <= c1 + 3:
                    it.col = k
                    it.data["col_x0"] = snap_edge(c0, edges)
                    break
            if it.col == -1:
                it.data["col_x0"] = min(c[0] for c in columns) if columns else it.x0
        if len(columns) <= 1:
            for it in items:
                it.col = 0
        full = sorted((it for it in items if it.col == -1), key=lambda i: i.y0)
        for it in items:
            if it.col == -1:
                it.band = full.index(it) + 1
            else:
                # Items above the middle of a full-width item come before it.
                it.band = sum(1 for f in full if (f.y0 + f.y1) / 2 < it.y0)
        items.sort(key=lambda i: (i.band, 0 if i.col == -1 else 1, i.col, round(i.base - i.size * 0.8 if i.kind == "line" else i.y0, 1), i.x0))
        ordered.extend(items)
    doc.items = ordered
    compute_pitch(doc)
    merge_definitions(doc)
    leaders_to_refs(doc)
    mark_paragraph_edges(doc)


def common_edges(page_columns: dict[int, list[tuple[float, float]]]) -> list[float]:
    """Left column edges used on many pages of the document."""
    counts: Counter[int] = Counter(round(c0) for cols in page_columns.values() for c0, _ in cols)
    needed = max(3, len(page_columns) // 20)
    return sorted(float(e) for e, n in counts.items() if n >= needed)


def snap_edge(c0: float, edges: list[float]) -> float:
    """A column holding only indented text (a list continued from the previous
    column) starts at the usual column edge, not at its first indented line."""
    candidates = [e for e in edges if c0 - 25 <= e <= c0 + 1]
    return max(candidates) if candidates else c0


def merge_indented_columns(columns: list[tuple[float, float]], edges: list[float]) -> list[tuple[float, float]]:
    """An isolated legend marker and its indented text share the recurring
    column edge learned from other pages of this document."""
    merged: list[tuple[float, float]] = []
    for c0, c1 in columns:
        if merged and snap_edge(c0, edges) == snap_edge(merged[-1][0], edges):
            merged[-1] = (merged[-1][0], c1)
        else:
            merged.append((c0, c1))
    return merged


def find_columns(items: list[Item], width: float) -> list[tuple[float, float]]:
    """Column intervals of a page: horizontal projection of all items that
    fit in a column; gaps between the covered intervals are gutters."""
    # Pieces of one PDF line split at a wide gap count as the whole line,
    # so that a numbered legend does not look like two columns.
    extents = [it.data.get("line_x", (it.x0, it.x1)) for it in items]
    spans = sorted((x0, x1) for x0, x1 in extents if x1 - x0 < width * 0.45)
    cols: list[list[float]] = []
    for x0, x1 in spans:
        if cols and x0 <= cols[-1][1] + 4:
            cols[-1][1] = max(cols[-1][1], x1)
        else:
            cols.append([x0, x1])
    return [(c[0], c[1]) for c in cols]


def compute_pitch(doc: Document) -> None:
    """Most common baseline distance between lines of one paragraph."""
    deltas: Counter[float] = Counter()
    prev: Item | None = None
    for it in doc.items:
        if it.kind != "line" or abs(it.size - doc.body_size) > 0.5:
            prev = None
            continue
        if prev is not None and prev.page == it.page and prev.col == it.col and prev.band == it.band:
            d = it.base - prev.base
            if doc.body_size * 0.9 <= d <= doc.body_size * 2:
                deltas[round(d, 1)] += 1
        prev = it
    doc.pitch = deltas.most_common(1)[0][0] if deltas else doc.body_size * 1.2


def mark_paragraph_edges(doc: Document) -> None:
    prev: Item | None = None
    for it in doc.items:
        if it.kind != "line":
            prev = None
            continue
        same = prev is not None and prev.page == it.page and prev.col == it.col and prev.band == it.band
        it.data["para_before"] = not same or doc.para_break(prev, it)  # type: ignore[arg-type]
        if prev is not None:
            prev.data["para_after"] = it.data["para_before"]
        prev = it
    if prev is not None:
        prev.data["para_after"] = True
    for it in doc.items:
        if it.kind == "line":
            it.data.setdefault("para_after", True)
