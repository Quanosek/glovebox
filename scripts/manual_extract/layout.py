"""Reading order (any number of columns, full-width bands), line pitch and
paragraph edges."""

from __future__ import annotations

from collections import Counter

from .definitions import merge_definitions
from .document import Document
from .headings import strong
from .leaders import leaders_to_refs
from .model import Item
from .text import BULLET_RE, FOOTNOTE_RE, clean_text


def assign_layout(doc: Document) -> None:
    by_page: dict[int, list[Item]] = {}
    for it in doc.items:
        by_page.setdefault(it.page, []).append(it)
    page_columns = {
        pno: [(0.0, doc.pdf[pno].rect.width)] if doc.args.single_column else find_columns(items, doc.pdf[pno].rect.width)
        for pno, items in by_page.items()
    }
    edges = common_edges(page_columns)
    if not doc.args.single_column:
        # Second pass: a short column (a one-line legend) is genuine when it
        # starts at a column edge used on many pages.
        page_columns = {pno: find_columns(items, doc.pdf[pno].rect.width, edges) for pno, items in by_page.items()}
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
        notes = footnotes(doc, items, doc.pdf[pno].rect.height)
        for it in items:
            if id(it) in notes:
                it.data["footnote"] = True
        ordered.extend([it for it in items if id(it) not in notes] + [it for it in items if id(it) in notes])
    doc.items = ordered
    move_spread_figures(doc)
    compute_pitch(doc)
    merge_definitions(doc)
    leaders_to_refs(doc)
    mark_paragraph_edges(doc)
    doc.flush_bullets = bullets_are_flush(doc)


def move_spread_figures(doc: Document) -> None:
    """A two-page spread: an illustration printed alone on a page and its
    numbered legend ("1", "A") starting on the next page. The illustration is
    read right before the legend, inside whatever section holds the legend."""
    pages: dict[int, list[Item]] = {}
    for it in doc.items:
        pages.setdefault(it.page, []).append(it)
    for pno, items in sorted(pages.items()):
        if not all(it.kind == "image" for it in items):
            continue
        if not any(it.x1 - it.x0 >= doc.pdf[pno].rect.width * 0.6 for it in items):
            continue
        legend = next((it for it in pages.get(pno + 1, []) if it.data.get("legend")), None)
        if legend is None or legend.data["legend"] not in ("1", "A"):
            continue
        moved = {id(it) for it in items}
        rest = [it for it in doc.items if id(it) not in moved]
        k = next(i for i, it in enumerate(rest) if it is legend)
        doc.items = rest[:k] + items + rest[k:]


def footnotes(doc: Document, items: list[Item], height: float) -> set[int]:
    """Footnotes in small print at the bottom of a column ("1) COC =
    certyfikat zgodności."). They are read after the whole page, so that a
    paragraph or a warning box continued in the next column stays whole."""
    notes: set[int] = set()
    for k, it in enumerate(items):
        if id(it) in notes or it.kind != "line" or it.data.get("frame") is not None:
            continue
        if it.y0 < height * 0.6 or it.size >= doc.body_size * 0.97 or not FOOTNOTE_RE.match(clean_text(it.text)):
            continue
        below = [o for o in items[k + 1 :] if o.col == it.col and o.band == it.band]
        if all(o.kind == "line" and o.size < doc.body_size * 0.97 and o.data.get("frame") is None for o in below):
            notes.update(id(o) for o in [it] + below)
    return notes


def bullets_are_flush(doc: Document) -> bool:
    """True when wrapped lines of bulleted items start under the bullet
    instead of under the item text (no hanging indent)."""
    flush = hanging = 0
    for prev, it in zip(doc.items, doc.items[1:]):
        if prev.kind != "line" or it.kind != "line" or it.data.get("para_before", True):
            continue
        m = BULLET_RE.match(clean_text(prev.text))
        if not m or m.group(1) in "\u2013\u2014-" or BULLET_RE.match(clean_text(it.text)):
            continue
        if abs(it.x0 - prev.x0) <= 1.5:
            flush += 1
        elif it.x0 > prev.x0 + 2:
            hanging += 1
    return flush >= 5 and flush > hanging * 2


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


def find_columns(items: list[Item], width: float, edges: list[float] | None = None) -> list[tuple[float, float]]:
    """Column intervals of a page: horizontal projection of all items that
    fit in a column; gaps between the covered intervals are gutters."""
    # Pieces of one PDF line split at a wide gap count as the whole line,
    # so that a numbered legend does not look like two columns.
    extents = [it.data.get("line_x", (it.x0, it.x1)) for it in items]
    spans = sorted((x0, x1) for x0, x1 in extents if x1 - x0 < width * 0.45)
    cols = cluster_spans(spans)
    if not spans:
        return cols
    # A few lines much wider than the others (a footnote under two columns)
    # do not join the columns they cross.
    widths = sorted(x1 - x0 for x0, x1 in spans)
    median = widths[len(widths) // 2]
    out: list[tuple[float, float]] = []
    for c0, c1 in cols:
        inside = [s for s in spans if c0 <= s[0] and s[1] <= c1]
        narrow = [s for s in inside if s[1] - s[0] <= median * 1.3]
        parts = cluster_spans(narrow)
        if len(parts) > 1 and len(inside) - len(narrow) <= 3 and all(genuine_column(p, narrow, edges or []) for p in parts):
            out.extend(widen(parts, inside))
        else:
            out.extend(split_at_edges(inside, edges or []))
    return out


def genuine_column(part: tuple[float, float], spans: list[tuple[float, float]], edges: list[float]) -> bool:
    """A part of a cluster is a column when it holds several lines or starts
    at a column edge used on many pages."""
    p0, p1 = part
    return sum(1 for s in spans if p0 <= s[0] and s[1] <= p1) >= 5 or any(abs(p0 - e) <= 3 for e in edges)


def split_at_edges(spans: list[tuple[float, float]], edges: list[float]) -> list[tuple[float, float]]:
    """Split a cluster where several lines start at a column edge used on
    many pages and at most three lines (titles, captions) cross it."""
    parts = [spans]
    for e in edges:
        last = parts[-1]
        lo, hi = min(s[0] for s in last), max(s[1] for s in last)
        if not lo + 20 < e < hi - 20:
            continue
        crossing = [s for s in last if s[0] < e - 3 and s[1] > e + 1]
        starting = [s for s in last if abs(s[0] - e) <= 3]
        left = [s for s in last if s[1] <= e + 1]
        if len(crossing) <= 3 and len(starting) >= 2 and left:
            parts[-1] = left
            parts.append([s for s in last if s[0] >= e - 3])
    return [(min(s[0] for s in p), max(s[1] for s in p)) for p in parts if p]


def widen(parts: list[tuple[float, float]], spans: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Wider lines that start in a column and end before the next one
    belong to that column."""
    out = [list(p) for p in parts]
    for x0, x1 in spans:
        for k, p in enumerate(out):
            nxt = out[k + 1][0] if k + 1 < len(out) else float("inf")
            if p[0] - 3 <= x0 < nxt and x1 < nxt - 2:
                p[1] = max(p[1], x1)
                break
    return [(p[0], p[1]) for p in out]


def cluster_spans(spans: list[tuple[float, float]]) -> list[tuple[float, float]]:
    cols: list[list[float]] = []
    for x0, x1 in spans:
        if cols and x0 <= cols[-1][1] + 4:
            cols[-1][1] = max(cols[-1][1], x1)
        else:
            cols.append([x0, x1])
    return [(c[0], c[1]) for c in cols]


def compute_pitch(doc: Document) -> None:
    """Most common baseline distance between lines of one paragraph, for the
    body text and for every other text style (font and size) that wraps."""
    deltas: Counter[float] = Counter()
    styles: dict[tuple[str, float], Counter[float]] = {}
    prev: Item | None = None
    for it in doc.items:
        if it.kind != "line":
            prev = None
            continue
        if prev is not None and prev.page == it.page and prev.col == it.col and prev.band == it.band:
            d = it.base - prev.base
            key = it.style
            if key == prev.style and it.size * 0.9 <= d <= it.size * 2:
                styles.setdefault(key, Counter())[round(d, 1)] += 1
            if abs(it.size - doc.body_size) <= 0.5 and abs(prev.size - doc.body_size) <= 0.5 and doc.body_size * 0.9 <= d <= doc.body_size * 2:
                deltas[round(d, 1)] += 1
        prev = it
    doc.pitch = deltas.most_common(1)[0][0] if deltas else doc.body_size * 1.2
    doc.style_pitch = {key: c.most_common(1)[0][0] for key, c in styles.items() if sum(c.values()) >= 10}



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
    mark_paragraph_sizes(doc)


def mark_paragraph_sizes(doc: Document) -> None:
    """Text of every paragraph of several lines that are all set in one
    emphasised style, stored on its first line (headings that wrap)."""
    rows: dict[tuple[int, int, int, int], int] = Counter()
    for it in doc.items:
        if it.kind == "line":
            rows[(it.page, it.col, it.band, round(it.base))] += 1
    para: list[Item] = []
    for it in doc.items + [None]:  # type: ignore[list-item]
        if para and (it is None or it.kind != "line" or it.data.get("para_before", True)):
            first = para[0]
            # Lines sharing a baseline with other text of their column are
            # table cells or legend entries, not a heading.
            def in_row(ln: Item) -> bool:
                return "line_x" in ln.data or sum(rows.get((ln.page, ln.col, ln.band, round(ln.base) + d), 0) for d in (-1, 0, 1)) > 1

            nxt = it if it is not None and it.kind == "line" and (it.page, it.col, it.band) == (first.page, first.col, first.band) else None
            # A header cell over a row of cells ("Przód | Tył") is not a heading either.
            cells = any(in_row(ln) for ln in para) or (nxt is not None and in_row(nxt))
            if len(para) > 1 and not cells and all(strong(ln) and abs(ln.size - first.size) < 0.3 for ln in para):
                first.data["strong_para"] = clean_text(" ".join(ln.plain for ln in para))
            para = []
        if it is not None and it.kind == "line":
            para.append(it)

