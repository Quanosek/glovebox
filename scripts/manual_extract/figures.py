"""Illustrations (raster images and clustered vector drawings) and the
pass that adds tables and figures to the items of every page."""

from __future__ import annotations

from collections import Counter
from typing import Any

from .document import Document
from .frames import assign_frames, page_frames
from .geometry import center, contains, merge_rects, overlap_ratio
from .model import Item
from .pdf import pymupdf
from .tables import grid_tables, ruled_tables
from .text import CAPTION_RE, clean_text


def add_tables_and_figures(doc: Document) -> None:
    """Tables and illustrations of every page join its lines; lines inside
    tables and short callout labels inside illustrations are dropped."""
    by_page: dict[int, list[Item]] = {}
    for it in doc.items:
        by_page.setdefault(it.page, []).append(it)
    new_items: list[Item] = []
    for pno in range(doc.page_count):
        page = doc.pdf[pno]
        lines = by_page.get(pno, [])
        tables: list[Item] = []
        if not doc.args.no_tables:
            tables = ruled_tables(doc, pno, lines)
            for t in grid_tables(doc, page):
                overlapping = [o for o in tables if overlap_ratio(pymupdf.Rect(t.bbox), pymupdf.Rect(o.bbox)) > 0.2]
                # A gridded table wins over a rule-only reading of the same
                # area that found fewer cells (a fragment of its header).
                if not overlapping or filled_cells(t) > sum(filled_cells(o) for o in overlapping):
                    tables = [o for o in tables if o not in overlapping] + [t]
        figures = find_figures(doc, page, tables, lines) if not doc.args.no_images else []
        keep: list[Item] = []
        in_picture = captions_inside(figures, lines)
        for ln in lines:
            c = center(ln.bbox)
            table = next((t for t in tables if contains(t.bbox, c)), None)
            if table is not None:
                # Kept for the rich cells (pictograms, references) of the table.
                table.data.setdefault("lines", []).append(ln)
                continue
            if id(ln) in in_picture:
                continue  # a caption printed inside the rendered illustration
            inside_fig = [f for f in figures if contains(f.bbox, c)]
            if inside_fig and len(clean_text(ln.text)) <= doc.args.callout_max_chars and not continues_line(keep, ln, doc.args.callout_max_chars):
                continue
            keep.append(ln)
        keep = attach_figure_captions(figures, keep)
        assign_frames(doc, pno, keep)
        new_items.extend(keep)
        new_items.extend(tables)
        new_items.extend(figures)
    doc.items = new_items


def attach_figure_captions(figures: list[Item], lines: list[Item]) -> list[Item]:
    """A caption printed beside an illustration (to its right, level with
    it) or right under it belongs to that illustration, wherever the column
    reading order would put it. Its lines leave the text flow."""
    if not figures:
        return lines
    ordered = sorted(lines, key=lambda ln: (ln.base, ln.x0))
    taken: set[int] = set()
    for ln in ordered:
        if id(ln) in taken or not CAPTION_RE.match(clean_text(ln.text)):
            continue
        best = None
        for f in figures:
            if f.data.get("caption_lines"):
                continue
            x0, y0, x1, y1 = f.bbox
            beside = 0 <= ln.x0 - x1 < 30 and y0 - 2 <= ln.y0 <= y1 + 2
            below = 0 <= ln.y0 - y1 < max(ln.size * 2.5, 12) and x0 - 4 <= ln.x0 <= x1
            if beside or below:
                dist = abs(ln.x0 - x1) if beside else ln.y0 - y1
                if best is None or dist < best[0]:
                    best = (dist, f)
        if best is None:
            continue
        caption = [ln]
        for nxt in ordered:
            if id(nxt) in taken or nxt is ln or nxt.base <= caption[-1].base:
                continue
            if abs(nxt.x0 - ln.x0) < 2 and nxt.base - caption[-1].base < max(caption[-1].size, nxt.size) * 1.6:
                caption.append(nxt)
        best[1].data["caption_lines"] = caption
        taken.update(id(c) for c in caption)
    return [ln for ln in lines if id(ln) not in taken]


def captions_inside(figures: list[Item], lines: list[Item]) -> set[int]:
    """Lines of figure captions ("Rys. 1 Otwieranie i za- / mykanie") that
    lie inside a rendered illustration: the picture already shows them."""
    out: set[int] = set()
    for f in figures:
        inside = sorted((ln for ln in lines if contains(f.bbox, center(ln.bbox))), key=lambda ln: (ln.base, ln.x0))
        for k, ln in enumerate(inside):
            if id(ln) in out or not CAPTION_RE.match(clean_text(ln.text)):
                continue
            out.add(id(ln))
            last = ln
            for nxt in inside[k + 1 :]:
                if abs(nxt.x0 - ln.x0) < 2 and 0 < nxt.base - last.base < max(last.size, nxt.size) * 1.6:
                    out.add(id(nxt))
                    last = nxt
    return out


def filled_cells(table: Item) -> int:
    return sum(1 for row in table.data["rows"] for cell in row if cell)


def continues_line(kept: list[Item], ln: Item, limit: int) -> bool:
    """A short last line of a caption ("mykanie" under "Rys. 1 Otwieranie
    i za-") is not a callout label: it is aligned under a longer kept line."""
    return any(
        abs(k.x0 - ln.x0) < 1.5 and 0 < ln.base - k.base < max(k.size, ln.size) * 1.6 and len(clean_text(k.text)) > limit
        for k in kept
    )


def find_figures(doc: Document, page: Any, tables: list[Item], lines: list[Item]) -> list[Item]:
    rects: list[tuple[pymupdf.Rect, bool]] = []  # (rect, is_raster)
    page_rect = page.rect
    for info in page.get_image_info(xrefs=True):
        r = pymupdf.Rect(info["bbox"]) & page_rect
        if r.is_empty or r.width < doc.args.min_icon or r.height < doc.args.min_icon:
            continue
        rects.append((r, True))
    if not doc.args.no_vector:
        try:
            clusters = page.cluster_drawings(drawings=content_drawings(doc, page), x_tolerance=3, y_tolerance=3)
        except Exception:  # pragma: no cover - older PyMuPDF
            clusters = []
        for r in clusters:
            r = pymupdf.Rect(r) & page_rect
            if r.width < doc.args.min_figure or r.height < doc.args.min_figure:
                continue
            if any(overlap_ratio(r, pymupdf.Rect(t.bbox)) > 0.3 for t in tables):
                continue
            if any(overlap_ratio(r, f) > 0.8 and abs(r.width - f.width) < 6 for f in page_frames(doc, page.number)):
                continue  # the box of a warning
            if looks_like_frame(doc, page, r, lines):
                continue
            rects.append((r, False))
    merged = merge_rects(rects)
    out: list[Item] = []
    for r, is_raster in merged:
        if not is_raster and text_density(r, lines) > 0.25:
            continue
        out.append(Item("image", page.number, (r.x0, r.y0, r.x1, r.y1), data={"raster": is_raster}))
    return out


def content_drawings(doc: Document, page: Any) -> list[Any]:
    """Drawings that may belong to illustrations. Page decoration is left
    out: backgrounds, patterns bleeding off the page (hatched borders) and
    bars of the running header or footer inside the margins."""
    pr = page.rect
    top, bottom = doc.rule_limits(page.number)
    out = []
    for d in doc.drawings(page):
        r = pymupdf.Rect(d["rect"])
        if r.x0 < pr.x0 - 2 or r.y0 < pr.y0 - 2 or r.x1 > pr.x1 + 2 or r.y1 > pr.y1 + 2:
            continue
        if r.width * r.height > pr.width * pr.height * 0.8:
            continue
        if r.y1 <= top or r.y0 >= bottom:
            continue
        out.append(d)
    return out


def looks_like_frame(doc: Document, page: Any, r: Any, lines: list[Item]) -> bool:
    """Boxes around warnings / text are drawn as rectangles: skip them."""
    items = [d for d in doc.drawings(page) if r.contains(pymupdf.Rect(d["rect"]))]
    if not items:
        return True
    kinds = Counter(op[0] for d in items for op in d["items"])
    only_straight = set(kinds) <= STRAIGHT
    if only_straight and text_density(r, lines) > 0.15:
        return True
    return border_with_pictograms(doc, r, items, lines)


STRAIGHT = {"re", "l", "qu"}


def border_with_pictograms(doc: Document, r: Any, items: list[Any], lines: list[Item]) -> bool:
    """A box drawn with lines along its edges around text and small inline
    pictograms ("see also" boxes) is not an illustration."""
    edge = 2.0
    has_border = False
    for d in items:
        dr = pymupdf.Rect(d["rect"])
        if {op[0] for op in d["items"]} <= STRAIGHT:
            on_edge = (
                (dr.height < edge and (abs(dr.y0 - r.y0) < edge or abs(dr.y1 - r.y1) < edge))
                or (dr.width < edge and (abs(dr.x0 - r.x0) < edge or abs(dr.x1 - r.x1) < edge))
            )
            if not on_edge:
                return False
            has_border = True
        elif max(dr.width, dr.height) >= doc.args.icon_size:
            return False
    return has_border and any(r.contains(pymupdf.Rect(ln.bbox)) and clean_text(ln.plain) for ln in lines)


def text_density(r: Any, lines: list[Item]) -> float:
    area = max(r.width * r.height, 1.0)
    covered = 0.0
    for ln in lines:
        lr = pymupdf.Rect(ln.bbox)
        if r.contains(lr) and len(clean_text(ln.text)) > 12:
            covered += lr.width * lr.height
    return covered / area
