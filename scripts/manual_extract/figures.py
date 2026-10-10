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
from .text import clean_text


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
                if not any(overlap_ratio(pymupdf.Rect(t.bbox), pymupdf.Rect(o.bbox)) > 0.2 for o in tables):
                    tables.append(t)
        figures = find_figures(doc, page, tables, lines) if not doc.args.no_images else []
        keep: list[Item] = []
        for ln in lines:
            c = center(ln.bbox)
            table = next((t for t in tables if contains(t.bbox, c)), None)
            if table is not None:
                # Kept for the rich cells (pictograms, references) of the table.
                table.data.setdefault("lines", []).append(ln)
                continue
            inside_fig = [f for f in figures if contains(f.bbox, c)]
            if inside_fig and len(clean_text(ln.text)) <= doc.args.callout_max_chars and not continues_line(keep, ln, doc.args.callout_max_chars):
                continue
            keep.append(ln)
        assign_frames(doc, pno, keep)
        new_items.extend(keep)
        new_items.extend(tables)
        new_items.extend(figures)
    doc.items = new_items


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
