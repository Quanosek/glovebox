"""Page model: text spans and the items (lines, tables, images) of a page."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

from .text import REF_MARK

# A rectangle in PDF points: (x0, y0, x1, y1).
Box = tuple[float, float, float, float]


@dataclass
class Span:
    text: str
    bold: bool
    italic: bool
    size: float
    font: str
    bbox: Box | None = None
    icon: bool = False  # glyphs of a pictogram font, rendered as an inline image
    color: int | None = None

    def copy(self, text: str | None = None) -> Span:
        """A copy of this span, optionally with other text."""
        return replace(self, text=self.text if text is None else text)


@dataclass
class Item:
    kind: str  # "line" | "table" | "image"
    page: int  # pdf page index (0-based)
    bbox: Box
    col: int = 0  # -1 full width, otherwise the column index (0 = leftmost)
    band: int = 0
    spans: list[Span] = field(default_factory=list)
    data: dict[str, Any] = field(default_factory=dict)
    base: float = 0.0  # baseline of the first text glyph (lines only)

    def with_spans(self, spans: list[Span]) -> Item:
        """A copy of this line with other spans (its data copied too)."""
        return Item(self.kind, self.page, self.bbox, self.col, self.band, spans, dict(self.data), self.base)

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.spans)

    @property
    def plain(self) -> str:
        """Text without inline pictograms."""
        return "".join(s.text for s in self.spans if not s.icon)

    @property
    def size(self) -> float:
        # Reference arrows ("›››") are often set larger than the text.
        sizes = [s.size for s in self.spans if s.text.replace(REF_MARK, "").strip() and not s.icon]
        if not sizes:
            sizes = [s.size for s in self.spans if s.text.strip() and not s.icon]
        return max(sizes) if sizes else 0.0

    @property
    def bold(self) -> bool:
        visible = [s for s in self.spans if s.text.strip() and s.text.strip() != REF_MARK and not s.icon]
        return bool(visible) and all(s.bold for s in visible)

    @property
    def style(self) -> tuple[str, float]:
        """Font of the longest text span and the size of the line."""
        spans = [s for s in self.spans if s.text.replace(REF_MARK, "").strip() and not s.icon]
        span = max(spans, key=lambda s: len(s.text.strip())) if spans else None
        return (span.font if span else "", self.size)

    @property
    def x0(self) -> float:
        return self.bbox[0]

    @property
    def x1(self) -> float:
        return self.bbox[2]

    @property
    def y0(self) -> float:
        return self.bbox[1]

    @property
    def y1(self) -> float:
        return self.bbox[3]

    @property
    def col_x0(self) -> float:
        """Left edge of the column the item belongs to."""
        return float(self.data.get("col_x0", self.bbox[0]))
