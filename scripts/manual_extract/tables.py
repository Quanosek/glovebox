"""Tables: rule-only tables (horizontal rules split at the column
boundaries) and gridded tables found by PyMuPDF."""

from __future__ import annotations

import re
import sys
from typing import Any

from .document import Document
from .frames import page_frames
from .geometry import center
from .model import Item, Span
from .text import REF_MARK, clean_text, join_line_texts, normalize_title


def ruled_tables(doc: Document, pno: int, lines: list[Item]) -> list[Item]:
    """Tables drawn with horizontal rules only. The rules are split into
    segments at the column boundaries, which gives the column grid."""
    top, bottom = doc.rule_limits(pno)
    frames = page_frames(doc, pno)
    segs = []
    for h in doc.horizontal_rules(pno):
        y = (h[1] + h[3]) / 2
        if not top < y < bottom:
            continue
        if any(f.x0 - 2.5 <= h[0] and h[2] <= f.x1 + 2.5 and f.y0 - 2.5 <= y <= f.y1 + 2.5 for f in frames):
            continue
        segs.append((h[0], y, h[2]))
    segs.sort(key=lambda s: (round(s[1]), s[0]))
    rule_rows: list[dict[str, Any]] = []
    by_y: list[list[tuple[float, float, float]]] = []
    for s in segs:
        if by_y and abs(by_y[-1][0][1] - s[1]) < 1.2:
            by_y[-1].append(s)
        else:
            by_y.append([s])
    for row in by_y:
        row.sort()
        chain = [row[0]]
        for s in row[1:] + [None]:  # type: ignore[list-item]
            if s is not None and s[0] - chain[-1][2] <= 3:
                chain.append(s)
                continue
            x0, x1 = chain[0][0], max(c[2] for c in chain)
            if x1 - x0 >= 60:
                breaks = [(a[2] + b[0]) / 2 for a, b in zip(chain, chain[1:]) if b[0] - x0 > 4 and x1 - a[2] > 4]
                rule_rows.append({"y": sum(c[1] for c in chain) / len(chain), "x0": x0, "x1": x1, "breaks": breaks})
            if s is not None:
                chain = [s]
    rule_rows.sort(key=lambda r: r["y"])
    _split_cells(lines, rule_rows, doc.body_size)

    def edges(r: dict[str, Any]) -> list[float]:
        return [r["x0"]] + r["breaks"] + [r["x1"]]

    def empty_gap(top: float, bottom: float) -> bool:
        """Rules of one table enclose rows; a wide empty strip between them
        separates two tables."""
        ys = sorted((ln.y0, ln.y1) for ln in lines if top < center(ln.bbox)[1] < bottom)
        edge = top
        for y0, y1 in ys + [(bottom, bottom)]:
            if y0 - edge > doc.body_size * 2.5:
                return True
            edge = max(edge, y1)
        return False

    def compatible(a: dict[str, Any], b: dict[str, Any]) -> bool:
        if b["y"] - a["y"] > 400 or empty_gap(a["y"], b["y"]):
            return False
        if abs(a["x0"] - b["x0"]) > 4 or abs(a["x1"] - b["x1"]) > 4:
            # A rule may skip cells that span several rows; its ends must
            # then sit on the column grid of the other rule.
            inner, outer = (a, b) if a["x1"] - a["x0"] < b["x1"] - b["x0"] else (b, a)
            grid = edges(outer)
            if not all(any(abs(x - g) <= 3 for g in grid) for x in (inner["x0"], inner["x1"])):
                return False
        small, big = sorted((a["breaks"], b["breaks"]), key=len)
        if not all(any(abs(x - y) <= 3 for y in big) for x in small):
            return False
        for ln in lines:
            if not a["y"] < center(ln.bbox)[1] < b["y"]:
                continue
            if ln.size >= doc.body_size * 1.08:
                return False
            if ln.bold and normalize_title(ln.plain) in doc.outline_titles:
                return False
            # Text across a column boundary between two rules is a caption
            # or a note between two tables, not a row.
            if any(ln.x0 + 10 < x < ln.x1 - 10 for x in big):
                return False
        return True

    groups: list[list[dict[str, Any]]] = []
    for r in rule_rows:
        if groups and compatible(groups[-1][-1], r):
            groups[-1].append(r)
        else:
            groups.append([r])
    out: list[Item] = []
    for g in groups:
        table = table_from_rules(doc, pno, g, lines)
        if table is not None:
            out.append(table)
    return out


def _split_cells(lines: list[Item], rule_rows: list[dict[str, Any]], body: float) -> None:
    """Cells printed close together form one PDF line ("Jakość oleju
    silnikowego Silniki benzynowe …"): between two rules with a column grid,
    a line starting at the left edge of the grid or lying in a one-row band
    is cut where its words start at a column boundary. Centred captions
    between two tables (a wider gap) stay whole."""
    out: list[Item] = []
    for ln in lines:
        cy = center(ln.bbox)[1]
        breaks = [
            x
            for a, b in zip(rule_rows, rule_rows[1:])
            if a["y"] < cy < b["y"]
            and (abs(ln.x0 - a["x0"]) < 4 or b["y"] - a["y"] <= body * 2.6)
            and a["x0"] - 2 <= ln.x0
            and ln.x1 <= a["x1"] + 2
            for x in a["breaks"] + b["breaks"]
        ]
        out.extend(split_at(ln, breaks) if breaks else [ln])
    lines[:] = out


def split_at(ln: Item, breaks: list[float], within: float = float("inf")) -> list[Item]:
    """Pieces of a line cut before the first word starting at each x (and
    at most `within` points after it)."""
    text = ln.text
    xs: list[float] | None = ln.data.get("char_x")
    if xs is None or len(xs) != len(text):
        return [ln]
    cuts: set[int] = set()
    for x in breaks:
        if not ln.x0 + 2 < x < ln.x1 - 2:
            continue
        for i in range(1, len(text)):
            if text[i] != " " and text[i - 1] == " " and xs[i] >= x - 1:
                # Compare with ordinary word spaces measured in this document.
                space = ln.data.get("space_width", ln.size * 0.28)
                if xs[i] <= x + within and xs[i] - xs[i - 1] >= space * 1.4:
                    cuts.add(i)
                break
    if not cuts:
        return [ln]
    bounds = [0, *sorted(cuts), len(text)]
    pieces: list[Item] = []
    for start, end in zip(bounds, bounds[1:]):
        spans: list[Span] = []
        pos = 0
        for s in ln.spans:
            a, b = max(start, pos), min(end, pos + len(s.text))
            if a < b:
                spans.append(Span(s.text[a - pos : b - pos], s.bold, s.italic, s.size, s.font, s.bbox, s.icon, s.color))
            pos += len(s.text)
        x1 = xs[end] - 1 if end < len(text) else ln.x1
        data = {**ln.data, "char_x": xs[start:end]}
        pieces.append(Item("line", ln.page, (xs[start], ln.y0, x1, ln.y1), ln.col, ln.band, spans, data, ln.base))
    return pieces


def table_from_rules(doc: Document, pno: int, rules: list[dict[str, Any]], lines: list[Item]) -> Item | None:
    x0 = min(r["x0"] for r in rules)
    x1 = max(r["x1"] for r in rules)
    breaks: list[float] = []
    for b in sorted(b for r in rules for b in r["breaks"]):
        if not breaks or b - breaks[-1] > 3:
            breaks.append(b)
    if not breaks:
        return None
    bounds = [x0] + breaks + [x1]
    body = doc.body_size

    def column(ln: Item) -> int | None:
        for k in range(len(bounds) - 1):
            if bounds[k] - 3 <= ln.x0 < bounds[k + 1] - 3:
                return k if ln.x1 <= bounds[k + 1] + 12 else None
        return None

    def new_values(cells: list[list[Item]], prev: list[list[Item]]) -> bool:
        """Values lower down in a column that already has values start a new
        row even without a label (the spare wheel row of a tyre table)."""
        for k in range(1, ncols):
            if cells[k] and prev[k] and all(is_value(clean_text(ln.plain)) for ln in cells[k]):
                if min(ln.base for ln in cells[k]) - max(ln.base for ln in prev[k]) > body * 1.6:
                    return True
        return False

    def head_column(ln: Item) -> int | None:
        """Header cells may span several data columns ("Wszystkie kraje …"
        over two engine columns); they go to the first column they cover.
        Text from the left edge across columns is a title, not a header."""
        k = column(ln)
        if k is not None or ln.x1 > x1 + 12:
            return k
        k = next((k for k in range(len(bounds) - 1) if bounds[k] - 3 <= ln.x0 < bounds[k + 1] - 3), None)
        return k if k else None

    candidates: list[Item] = []
    for ln in lines:
        if not x0 - 2 <= center(ln.bbox)[0] <= x1 + 2:
            continue
        if ln.y1 <= rules[0]["y"] + 2:
            # Header cells printed as one line ("[kPa/bar] ([psi]) [kPa/bar] …")
            # are cut only where a word starts right at a column boundary.
            candidates.extend(split_at(ln, breaks, within=3))
        else:
            candidates.append(ln)
    first, last = rules[0]["y"], rules[-1]["y"]

    def text_rows(selected: list[Item]) -> list[list[Item]]:
        rows: list[list[Item]] = []
        for ln in sorted(selected, key=lambda i: (i.base, i.x0)):
            if rows and abs(rows[-1][0].base - ln.base) < 2:
                rows[-1].append(ln)
            else:
                rows.append([ln])
        return rows

    # Header (or the only row of a one-rule table) above the first rule.
    above = text_rows([ln for ln in candidates if ln.y1 <= first + 2 and center(ln.bbox)[1] < first])
    head: list[list[Item]] = []
    for row in reversed(above):
        ref_y = head[-1][0].base if head else None
        if ref_y is None:
            if first - max(ln.y1 for ln in row) > body * 1.2:
                break
        elif ref_y - row[0].base > body * 1.45:
            break
        if any(ln.size >= body * 1.08 or head_column(ln) is None for ln in row) or len(head) >= 6:
            break
        if any(ln.bold and normalize_title(ln.plain) in doc.outline_titles for ln in row):
            break
        head.append(row)
    head.reverse()
    if head and all(head_column(ln) == 0 for row in head for ln in row):
        head = []
    bands: list[list[list[Item]]] = []
    if head:
        bands.append(head)
    for a, b in zip(rules, rules[1:]):
        band = text_rows([ln for ln in candidates if a["y"] < center(ln.bbox)[1] < b["y"]])
        if band:
            bands.append(band)
    # Some tables end at a page break without a bottom rule. Keep aligned
    # cells below the last rule, but not a caption, prose or a footnote.
    tail: list[list[Item]] = []
    edge = last
    for row in text_rows([ln for ln in candidates if center(ln.bbox)[1] > last]):
        cols = {column(ln) for ln in row}
        if (
            min(ln.y0 for ln in row) - edge > body * 1.5
            or None in cols
            or any(ln.size >= body * 1.08 or ln.bold and normalize_title(ln.plain) in doc.outline_titles for ln in row)
            or (len(cols) < 2 and (not tail or 0 in cols))
        ):
            break
        tail.append(row)
        edge = max(ln.y1 for ln in row)
    if tail:
        bands.append(tail)
        last = edge
    if not bands:
        return None
    ncols = len(bounds) - 1
    table_rows: list[list[list[Item]]] = []
    for band in bands:
        band_rows: list[list[list[Item]]] = []
        for row in band:
            cells: list[list[Item]] = [[] for _ in range(ncols)]
            for ln in row:
                k = head_column(ln)
                cells[k if k is not None else 0].append(ln)
            first_cell = clean_text(" ".join(ln.plain for ln in cells[0]))
            others = any(cells[1:])
            prev_first = cell_text(band_rows[-1][0]) if band_rows else ""
            if band_rows and not new_values(cells, band_rows[-1]) and (
                not first_cell
                or prev_first.endswith((",", "-", "/"))
                or (first_cell[:1].islower() or first_cell[:1] == "(") and not others
            ):
                for k in range(ncols):
                    band_rows[-1][k].extend(cells[k])
            else:
                band_rows.append(cells)
        table_rows.extend(band_rows)
    kept = [(row, [cell_text(cell) for cell in row]) for row in table_rows]
    kept = [(row, texts) for row, texts in kept if any(texts)]
    rows = [texts for _, texts in kept]
    used = [k for k in range(ncols) if any(r[k] for r in rows)]
    if len(used) < 2 or not rows:
        return None
    rows = [[r[k] for k in used] for r in rows]
    cell_lines = [[row[k] for k in used] for row, _ in kept]
    cell_boxes = []
    for row, _ in kept:
        ys = [ln.y0 for cell in row for ln in cell] + [ln.y1 for cell in row for ln in cell]
        cell_boxes.append([(bounds[k], min(ys), bounds[k + 1], max(ys)) for k in used])
    top = min([first] + [ln.y0 for row in head for ln in row])
    if len(rules) == 1:
        # One rule under text: a one-row table ("AdBlue, ilość [l] | 7,5"),
        # unless the text is a lone header ("Nr  Obwód") over rows without rules.
        if not tail and not any(re.search(r"\d", c) for r in rows for c in r[1:]):
            return None
        header = bool(head) if tail else False
    else:
        # A table continued from the previous page starts with values.
        header = bool(head) or (len(rows) > 1 and not any(is_value(c) for c in rows[0][1:]))
    return Item("table", pno, (x0, top, x1, last), data={"rows": rows, "header": header, "cell_lines": cell_lines, "cell_boxes": cell_boxes})


def is_value(cell: str) -> bool:
    """Numbers, ticks and dashes ("1,0", "✔", "–", "235/2,3 (34)")."""
    return bool(cell) and re.fullmatch(r"[\d\s.,/:()\-–—✔✓×+%]+", cell) is not None


def grid_tables(doc: Document, page: Any) -> list[Item]:
    out: list[Item] = []
    try:
        # Strict lines: backgrounds (highlighted words) are not table grids.
        found = page.find_tables(strategy="lines_strict")
    except Exception as exc:  # pragma: no cover - depends on PDF
        print(f"  ! table detection failed on page {page.number + 1}: {exc}", file=sys.stderr)
        return out
    for tab in found.tables:
        rows = tab.extract()
        boxes: list[list[Any]] = [list(r.cells) for r in tab.rows]
        header_external = bool(getattr(tab.header, "external", False))
        if header_external:
            rows = [list(tab.header.names)] + rows
            hb = tab.header.bbox
            boxes = [[(c[0], hb[1], c[2], hb[3]) if c else None for c in (boxes[0] if boxes else [])]] + boxes
        if len(boxes) != len(rows):
            boxes = [[] for _ in rows]
        pairs = [([clean_cell(c) for c in row], box) for row, box in zip(rows, boxes)]
        # A row without text may still hold pictograms: keep it when it has cells.
        pairs = [(r, b) for r, b in pairs if any(r)]
        if not pairs:
            continue
        ncols = max(len(r) for r, _ in pairs)
        rows = [r + [""] * (ncols - len(r)) for r, _ in pairs]
        boxes = [list(b) + [None] * (ncols - len(b)) for _, b in pairs]
        # A column of pictograms has no text but a header ("Symbol").
        non_empty_cols = [i for i in range(ncols) if any(r[i] for r in rows)]
        rows = [[r[i] for i in non_empty_cols] for r in rows]
        boxes = [[tuple(b[i]) if b[i] else None for i in non_empty_cols] for b in boxes]
        if len(non_empty_cols) < 2 or len(rows) < 2:
            continue
        # Explanations printed in a last row across the whole table ("X: Nie
        # można zamontować…") are notes under the table, not a row.
        notes: list[tuple[float, float, float, float]] = []
        width = tab.bbox[2] - tab.bbox[0]
        while len(rows) > 2 and boxes[-1][0] and all(b is None for b in boxes[-1][1:]) and boxes[-1][0][2] - boxes[-1][0][0] >= width * 0.9:
            notes.insert(0, boxes[-1][0])
            rows.pop()
            boxes.pop()
        data: dict[str, Any] = {"rows": rows, "cell_boxes": boxes}
        spans = cell_spans(boxes)
        if spans is not None:
            data["spans"] = spans
            head = max((s[1] for s in spans[0] if s), default=1)
            if head > 1:
                data["header_rows"] = head
            # Cells covered by a merged cell keep no text of their own.
            for r, row in enumerate(spans):
                for c, s in enumerate(row):
                    if s is None:
                        rows[r][c] = ""
        if notes:
            data["notes"] = notes
        out.append(Item("table", page.number, tuple(tab.bbox), data=data))  # type: ignore[arg-type]
    return out


def cell_spans(boxes: list[list[Any]]) -> list[list[list[int] | None]] | None:
    """Column and row spans of merged cells (`[colspan, rowspan]`, `None` for
    a position covered by a merged cell), or None when no cell is merged."""
    nrows, ncols = len(boxes), max((len(b) for b in boxes), default=0)
    col_x0 = [min((b[i][0] for b in boxes if i < len(b) and b[i]), default=None) for i in range(ncols)]
    row_y0 = [min((c[1] for c in b if c), default=None) for b in boxes]
    spans: list[list[list[int] | None]] = [[[1, 1] for _ in range(ncols)] for _ in range(nrows)]
    covered: set[tuple[int, int]] = set()
    merged = False
    for r, row in enumerate(boxes):
        for c, box in enumerate(row):
            if box is None:
                continue
            cs = sum(1 for j in range(c, ncols) if col_x0[j] is not None and col_x0[j] < box[2] - 1)
            rs = sum(1 for k in range(r, nrows) if row_y0[k] is not None and row_y0[k] < box[3] - 1)
            cs, rs = max(cs, 1), max(rs, 1)
            if cs > 1 or rs > 1:
                merged = True
                spans[r][c] = [cs, rs]
                covered.update((k, j) for k in range(r, r + rs) for j in range(c, c + cs) if (k, j) != (r, c))
    if not merged:
        return None
    for r, c in covered:
        if r < nrows and c < ncols and boxes[r][c] is None:
            spans[r][c] = None
    return spans


def cell_text(lines: list[Item]) -> str:
    out = ""
    for ln in sorted(lines, key=lambda i: (round(i.base), i.x0)):
        text = clean_text(ln.plain)
        if not text:
            continue
        if out:
            prev, sep = join_line_texts(out, text)
            out = prev + sep + text
        else:
            out = text
    return clean_text(re.sub(REF_MARK + r"[\s" + REF_MARK + r"]*", "⇒ ", out))


def clean_cell(c: Any) -> str:
    if c is None:
        return ""
    text = str(c)
    parts = text.split("\n")
    out = parts[0]
    for nxt in parts[1:]:
        prev, sep = join_line_texts(out, nxt)
        out = prev + sep + nxt.strip()
    # Private-use glyphs are pictograms drawn by a symbol font, not text.
    return clean_text(re.sub("[\ue000-\uf8ff]", "", out).replace(REF_MARK, "⇒"))
