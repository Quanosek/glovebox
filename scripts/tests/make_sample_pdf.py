"""Builds a small synthetic PDF with a representative vehicle-manual layout.

Used by the extractor tests (the real manuals are copyrighted and are not
committed). Layout: A5-like pages, two columns, running header with page
number, outline (bookmarks), bold headings, framed and unframed warnings,
bullet and numbered lists, hyphenation, page references in a symbol font,
a raster illustration with callout numbers, a vector drawing and a table.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw

FONT_DIRS = [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/dejavu",
    "/System/Library/Fonts/Supplemental",
    "/Library/Fonts",
    str(Path.home() / "Library/Fonts"),
    "C:/Windows/Fonts",
]
FONT_PAIRS = [
    ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf"),
    ("Georgia.ttf", "Georgia Bold.ttf"),
    ("georgia.ttf", "georgiab.ttf"),
]


def _fonts() -> tuple[str, str]:
    for regular, bold in FONT_PAIRS:
        for directory in FONT_DIRS:
            regular_path = Path(directory) / regular
            bold_path = Path(directory) / bold
            if regular_path.is_file() and bold_path.is_file():
                return str(regular_path), str(bold_path)
    raise RuntimeError(
        "Do utworzenia dokumentu testowego potrzebne są czcionki DejaVu Sans lub Georgia "
        "w wersji zwykłej i pogrubionej. Zainstaluj DejaVu Sans "
        "w jednym z folderów: " + ", ".join(FONT_DIRS)
    )

W, H = 420, 595
MARGIN = 30
COL_W = (W - 2 * MARGIN - 14) / 2
BODY = 8.0


class Writer:
    def __init__(self, doc: pymupdf.Document) -> None:
        regular, bold = _fonts()
        self.doc = doc
        self.page: pymupdf.Page | None = None
        self.col = 0
        self.y = 0.0
        self.page_no = 0
        self.header = ""
        self.fonts = {
            "reg": pymupdf.Font(fontfile=regular),
            "bld": pymupdf.Font(fontfile=bold),
            "symb": pymupdf.Font("symb"),
        }

    def new_page(self, header: str) -> None:
        self.page = self.doc.new_page(width=W, height=H)
        self.page.insert_font(fontname="reg", fontbuffer=self.fonts["reg"].buffer)
        self.page.insert_font(fontname="bld", fontbuffer=self.fonts["bld"].buffer)
        self.page_no += 1
        printed = self.page_no + 2  # printed numbers start at 3
        self.header = header
        if self.page_no % 2:
            self.page.insert_text((MARGIN, 22), header, fontname="reg", fontsize=7)
            self.page.insert_text((W - MARGIN - 12, 22), f"{printed}", fontname="reg", fontsize=7)
        else:
            self.page.insert_text((MARGIN, 22), f"{printed}", fontname="reg", fontsize=7)
            self.page.insert_text((MARGIN + 20, 22), header, fontname="reg", fontsize=7)
        self.col = 0
        self.y = 50

    @property
    def x(self) -> float:
        return MARGIN + self.col * (COL_W + 14)

    def ensure(self, h: float) -> None:
        if self.y + h > H - 40:
            if self.col == 0:
                self.col = 1
                self.y = 50
            else:
                self.new_page(self.header)

    def line(self, parts: list[tuple[str, str]], size: float = BODY, indent: float = 0) -> None:
        """parts: list of (text, font) where font in reg/bld/symb."""
        self.ensure(size * 1.3)
        x = self.x + indent
        assert self.page is not None
        for text, font in parts:
            self.page.insert_text((x, self.y + size), text, fontname=font, fontsize=size)
            x += self.fonts[font].text_length(text, fontsize=size)
        self.y += size * 1.3

    def gap(self, k: float = 0.8) -> None:
        self.y += BODY * k

    def heading(self, text: str, size: float) -> int:
        self.gap(0.6)
        self.line([(text, "bld")], size=size)
        self.gap(0.3)
        return self.page_no

    def warning(self, label: str, lines: list[str], framed: bool) -> None:
        h = (len(lines) + 1) * BODY * 1.3 + 8
        self.ensure(h)
        assert self.page is not None
        top = self.y
        if framed:
            self.page.draw_rect(pymupdf.Rect(self.x - 3, top - 2, self.x + COL_W, top + h - 4), color=(0, 0, 0), width=0.6)
        self.line([(label, "bld")])
        for t in lines:
            self.line([(t, "reg")])
        self.gap(1)

    def image(self) -> None:
        self.ensure(90)
        assert self.page is not None
        img = Image.new("RGB", (240, 160), "white")
        d = ImageDraw.Draw(img)
        d.rectangle((20, 30, 220, 130), outline="black", width=4)
        d.ellipse((60, 50, 120, 110), outline="black", width=4)
        buf = io.BytesIO()
        img.save(buf, "PNG")
        r = pymupdf.Rect(self.x, self.y, self.x + 120, self.y + 80)
        self.page.insert_image(r, stream=buf.getvalue())
        self.page.insert_text((r.x0 + 4, r.y0 + 12), "1", fontname="reg", fontsize=7)
        self.page.insert_text((r.x1 - 10, r.y1 - 6), "2", fontname="reg", fontsize=7)
        self.y += 90

    def vector(self) -> None:
        self.ensure(70)
        assert self.page is not None
        x, y = self.x, self.y
        shape = self.page.new_shape()
        shape.draw_circle((x + 40, y + 30), 25)
        shape.draw_bezier((x + 5, y + 60), (x + 30, y), (x + 60, y + 60), (x + 100, y + 10))
        shape.draw_line((x + 70, y + 10), (x + 110, y + 50))
        shape.finish(color=(0, 0, 0), width=1)
        shape.commit()
        self.y += 70

    def table(self) -> None:
        rows = [["Silnik", "Moc [kW]", "Moc [KM]"], ["B16SHT", "125", "170"], ["B14NET", "103", "140"]]
        self.ensure(60)
        assert self.page is not None
        x0, y0 = self.x, self.y
        cw, rh = COL_W / 3, 14
        for i, row in enumerate(rows):
            for j, cell in enumerate(row):
                r = pymupdf.Rect(x0 + j * cw, y0 + i * rh, x0 + (j + 1) * cw, y0 + (i + 1) * rh)
                self.page.draw_rect(r, color=(0, 0, 0), width=0.5)
                self.page.insert_text((r.x0 + 3, r.y1 - 4), cell, fontname="bld" if i == 0 else "reg", fontsize=7)
        self.y += len(rows) * rh + 10


def build(path: str) -> None:
    doc = pymupdf.open()
    w = Writer(doc)
    toc: list[list[object]] = []

    # Front matter (ignored: it precedes the first outline entry).
    w.new_page("Wprowadzenie")
    w.line([("Spis treści", "bld")], size=14)

    w.new_page("Kluczyki, drzwi i szyby")
    toc.append([1, "Kluczyki, drzwi i szyby", w.heading("Kluczyki, drzwi i szyby", 14)])
    toc.append([2, "Kluczyki, zamki", w.heading("Kluczyki, zamki", 11)])
    toc.append([3, "Kluczyki", w.heading("Kluczyki", 9.5)])
    w.line([("Kluczyka nie należy przypinać do", "reg")])
    w.line([("innych przedmiotów. Zapasowy klu-", "reg")])
    w.line([("czyk przechowywać w bezpiecznym", "reg")])
    w.line([("miejscu.", "reg")])
    w.gap()
    w.line([("System Start-", "reg")])
    w.line([("Stop nie jest dostępny ", "reg"), ("3", "symb"), (" 45.", "reg")])
    w.gap()
    w.line([("• Naciśnąć przycisk ", "reg"), ("c", "bld"), (".", "reg")])
    w.line([("• Kluczyk złożyć do wnętrza obu-", "reg")])
    w.line([("dowy.", "reg")], indent=8)
    w.gap()
    w.warning("Ostrzeżenie", ["Nie zostawiać dzieci w samo-", "chodzie bez opieki."], framed=True)
    w.warning("Uwaga", ["Bateria pilota wymaga wymiany."], framed=False)
    w.line([("Kolejny akapit po uwadze.", "reg")])
    w.gap()
    w.image()
    toc.append([2, "Dach", w.heading("Dach", 11)])
    w.line([("1. Odblokować dach.", "reg")])
    w.line([("2. Przytrzymać dźwignię.", "reg")])
    w.gap()
    w.vector()
    w.new_page("Dane techniczne")
    toc.append([1, "Dane techniczne", w.heading("Dane techniczne", 14)])
    toc.append([2, "Dane silnika", w.heading("Dane silnika", 11)])
    w.table()
    w.line([("Wartości orientacyjne.", "reg")])
    w.new_page("Skorowidz")
    toc.append([1, "Skorowidz", w.heading("Skorowidz", 14)])
    w.line([("Akumulator ........ 120", "reg")])
    # Repeat header pages so that running headers are detected as such.
    for _ in range(3):
        w.new_page("Skorowidz")
        w.line([("Bagażnik ........ 30", "reg")])
    doc.set_toc(toc)
    doc.save(path)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "sample.pdf")
