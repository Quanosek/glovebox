"""Rectangle helpers (PDF points, `(x0, y0, x1, y1)`)."""

from __future__ import annotations

from typing import Any

from .model import Box
from .pdf import pymupdf


def center(b: Box) -> tuple[float, float]:
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def contains(b: Box, p: tuple[float, float]) -> bool:
    return b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3]


def overlap_ratio(a: Any, b: Any) -> float:
    inter = a & b
    if inter.is_empty:
        return 0.0
    return (inter.width * inter.height) / max(min(a.width * a.height, b.width * b.height), 1.0)


def merge_rects(rects: list[tuple[Any, bool]]) -> list[tuple[Any, bool]]:
    items = [(pymupdf.Rect(r), raster) for r, raster in rects]
    changed = True
    while changed:
        changed = False
        out: list[tuple[Any, bool]] = []
        while items:
            r, raster = items.pop()
            grown = pymupdf.Rect(r.x0 - 2, r.y0 - 2, r.x1 + 2, r.y1 + 2)
            for i, (o, oraster) in enumerate(out):
                if grown.intersects(o):
                    out[i] = (o | r, oraster or raster)
                    changed = True
                    break
            else:
                out.append((r, raster))
        items = out
    return sorted(items, key=lambda x: (x[0].y0, x[0].x0))
