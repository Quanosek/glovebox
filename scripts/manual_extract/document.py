"""State of one PDF being extracted, shared by all extraction steps."""

from __future__ import annotations

import argparse
import re
from typing import Any

from .model import Box, Item
from .pdf import pymupdf
from .text import normalize_title


class Document:
    """The opened PDF, its items in reading order and measured properties
    (body font size, line pitch, printed page numbers, warning boxes)."""

    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.pdf = pymupdf.open(args.pdf)
        self.outline_titles = {normalize_title(title) for _, title, *_ in self.pdf.get_toc()}
        self.page_count = self.pdf.page_count if not args.max_pages else min(args.max_pages, self.pdf.page_count)
        self.ref_font_re = re.compile(args.ref_font, re.I)
        self.bold_font_re = re.compile(r"bold|black|heavy|semibold|demi", re.I)
        self.italic_font_re = re.compile(r"italic|oblique", re.I)
        self.items: list[Item] = []
        self.printed: dict[int, int] = {}
        self.body_size = 9.0
        self.image_hashes: dict[str, dict[str, Any]] = {}
        self.icon_hashes: dict[str, dict[str, Any]] = {}
        self.drawings_cache: dict[int, list[Any]] = {}
        self.frames: dict[int, list[Any]] = {}
        self.labeled_frames: set[tuple[int, int]] = set()
        self.pitch = 0.0
        # Line pitch of text styles (font, size) that wrap with their own leading.
        self.style_pitch: dict[tuple[str, float], float] = {}
        # Wrapped lines of bulleted items start under the bullet (no hanging indent).
        self.flush_bullets = False

    def rule_limits(self, pno: int) -> tuple[float, float]:
        """Top / bottom margin of a page. A full-width rule near the top or the
        bottom (under a running header, over a footer) extends the margin."""
        page = self.pdf[pno]
        width, height = page.rect.width, page.rect.height
        top, bottom = height * self.args.margin_top, height * (1 - self.args.margin_bottom)
        for r in self.horizontal_rules(pno):
            if r[2] - r[0] < width * 0.6:
                continue
            y = (r[1] + r[3]) / 2
            if y < height * 0.15:
                top = max(top, y + 1)
            elif y > height * 0.85:
                bottom = min(bottom, y - 1)
        return top, bottom

    def horizontal_rules(self, pno: int) -> list[Box]:
        out: list[Box] = []
        for d in self.drawings(self.pdf[pno]):
            for op in d["items"]:
                if op[0] == "l":
                    a, b = op[1], op[2]
                    if abs(a.y - b.y) < 0.8 and abs(a.x - b.x) >= 8:
                        out.append((min(a.x, b.x), min(a.y, b.y), max(a.x, b.x), max(a.y, b.y)))
                elif op[0] == "re":
                    r = op[1]
                    if r.height < 2.2 and r.width >= 8 and (d.get("fill") is not None or d.get("color") is not None):
                        out.append((r.x0, r.y0, r.x1, r.y1))
        return out

    def drawings(self, page: Any) -> list[Any]:
        if page.number not in self.drawings_cache:
            try:
                self.drawings_cache[page.number] = page.get_drawings()
            except Exception:  # pragma: no cover
                self.drawings_cache[page.number] = []
        return self.drawings_cache[page.number]

    def para_break(self, prev: Item, it: Item) -> bool:
        """True when `it` starts a new block after `prev` in the same column."""
        # Sub- and superscripts push the next line down a little.
        delta = it.base - prev.base - prev.data.get("sub_drop", 0.0) - it.data.get("sup_rise", 0.0)
        if abs(it.base - prev.base) < 1:
            return False  # pieces of one line split at a wide gap
        if it.base < prev.base:
            return True
        size = max(prev.size, it.size, self.body_size)
        pitch = self.pitch * size / self.body_size
        style = it.style
        if style == prev.style and style in self.style_pitch:
            # Never more breaks than the body text pitch would give, and
            # never a leading far looser than the body text.
            pitch = max(pitch, min(self.style_pitch[style], pitch * 1.25))
        return delta > pitch + self.body_size * self.args.para_gap
