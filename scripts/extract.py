#!/usr/bin/env python3
"""Extract structured content and illustrations from an Opel owner's manual PDF.

Produces the JSON format described in `src/content/types.ts`:

    <out>/index.json            book index (flat table of contents)
    <out>/<chapter-slug>.json   blocks for every section of one chapter
    <assets>/<chapter-slug>/*.webp

Strategy
--------
1. Every page is read with PyMuPDF (`page.get_text("dict")`), keeping font
   size / weight of every span.
2. Running headers/footers are detected as text repeated in the page margins
   and removed; printed page numbers are taken from them.
3. Reading order handles the two-column layout: full-width items split a page
   into horizontal bands, inside a band the left column is read before the
   right one.
4. Tables (`page.find_tables()`), raster images and vector illustrations
   (`page.cluster_drawings()`) become separate items. Illustrations are
   rendered from the page (so callout numbers drawn over them are kept) and
   saved as WebP.
5. The PDF outline (bookmarks) defines chapters and sections. Entries deeper
   than `--max-page-level` become headings inside their parent page. Without
   an outline, headings are detected from font sizes.
6. Lines are assembled into headings, paragraphs, lists, warnings
   ("Niebezpieczeństwo", "Ostrzeżenie", "Przestroga", "Uwaga") with
   de-hyphenation and page references ("⇒ 45") turned into links.

Run through `pnpm extract` (see `scripts/extract.mjs`).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import pymupdf
except ImportError:  # pragma: no cover - environment check
    sys.stderr.write(
        "PyMuPDF is missing. Install it with:\n"
        "  python -m pip install -r scripts/requirements.txt\n"
    )
    sys.exit(2)

from PIL import Image

FORMAT_VERSION = 1

WARNING_LABELS = {
    "niebezpieczeństwo": ("danger", "Niebezpieczeństwo"),
    "ostrzeżenie": ("warning", "Ostrzeżenie"),
    "przestroga": ("caution", "Przestroga"),
    "uwaga": ("note", "Uwaga"),
}

# Sentinel used for arrow glyphs that introduce page references.
REF_MARK = "\u21d2"
TEXT_ARROWS = "→⇒⇨➜➔➞►▶"
BULLET_RE = re.compile(r"^([■●•▪◆○◦\u2013\u2014\-])\s+")
ORDERED_RE = re.compile(r"^(\d{1,2})[.)]\s+")
REF_RE = re.compile(REF_MARK + r"\s*(\d{1,3})((?:\s*(?:,|i|oraz)\s*\d{1,3})*)")
SENTENCE_END = (".", ":", "!", "?", ";")

POLISH_TRANSLIT = str.maketrans(
    {
        "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n",
        "ó": "o", "ś": "s", "ź": "z", "ż": "z",
    }
)


# --------------------------------------------------------------------------
# Small text helpers (unit tested in scripts/tests)
# --------------------------------------------------------------------------


def slugify(text: str, max_len: int = 60) -> str:
    text = text.lower().translate(POLISH_TRANSLIT)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if len(text) > max_len:
        text = text[:max_len].rsplit("-", 1)[0] or text[:max_len]
    return text or "sekcja"


def normalize_title(text: str) -> str:
    text = text.replace("\u00ad", "").replace(REF_MARK, "")
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text.rstrip(" .:")


def join_line_texts(prev: str, nxt: str) -> tuple[str, str]:
    """Return (prev_fixed, separator) used to join two consecutive lines.

    Handles hyphenation: "zamy-" + "kanie" -> "zamykanie", while compound
    words keep the hyphen: "Start-" + "Stop" -> "Start-Stop".
    """
    stripped = prev.rstrip()
    if stripped.endswith("\u00ad"):
        return stripped[:-1], ""
    if stripped.endswith("-") and len(stripped) >= 2 and stripped[-2].isalpha():
        first = nxt.lstrip()[:1]
        if first and first.islower():
            return stripped[:-1], ""
        return stripped, ""
    return stripped, " "


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\u00ad", "").replace("\ufb01", "fi").replace("\ufb02", "fl")
    text = re.sub(r"[ \t\u00a0]+", " ", text)
    return text.strip()


def build_runs(chars: list[tuple[str, bool, bool]]) -> list[Any]:
    """Convert styled characters into JSON runs; resolve page references."""
    text = "".join(c for c, _, _ in chars)
    runs: list[Any] = []

    def push(segment: list[tuple[str, bool, bool]]) -> None:
        buf = ""
        style: tuple[bool, bool] | None = None
        for ch, b, i in segment:
            if ch == REF_MARK:
                continue
            if style is not None and (b, i) != style and ch != " ":
                emit(buf, style)
                buf = ""
                style = (b, i)
            if style is None:
                style = (b, i)
            buf += ch
        if buf:
            emit(buf, style or (False, False))

    def emit(buf: str, style: tuple[bool, bool]) -> None:
        if not buf:
            return
        b, i = style
        if not b and not i:
            if runs and isinstance(runs[-1], str):
                runs[-1] += buf
            else:
                runs.append(buf)
            return
        run: dict[str, Any] = {"t": buf}
        if b:
            run["b"] = True
        if i:
            run["i"] = True
        prev = runs[-1] if runs else None
        if isinstance(prev, dict) and "t" in prev and prev.get("b") == run.get("b") and prev.get("i") == run.get("i"):
            prev["t"] += buf
        else:
            runs.append(run)

    pos = 0
    for m in REF_RE.finditer(text):
        push(chars[pos : m.start()])
        numbers = [int(m.group(1))] + [int(n) for n in re.findall(r"\d{1,3}", m.group(2) or "")]
        for idx, n in enumerate(numbers):
            if idx:
                emit(", ", (False, False))
            runs.append({"page": n})
        pos = m.end()
    push(chars[pos:])

    # Collapse whitespace across runs and trim the ends.
    out: list[Any] = []
    for r in runs:
        if isinstance(r, str):
            r = re.sub(r"\s+", " ", r)
        elif "t" in r:
            r["t"] = re.sub(r"\s+", " ", r["t"])
        out.append(r)
    while out and _run_text(out[0]).strip() == "" and not _is_ref(out[0]):
        out.pop(0)
    while out and _run_text(out[-1]).strip() == "" and not _is_ref(out[-1]):
        out.pop()
    if out:
        out[0] = _with_text(out[0], _run_text(out[0]).lstrip())
        out[-1] = _with_text(out[-1], _run_text(out[-1]).rstrip())
    return out


def _is_ref(run: Any) -> bool:
    return isinstance(run, dict) and "page" in run


def _run_text(run: Any) -> str:
    if isinstance(run, str):
        return run
    return run.get("t", "")


def _with_text(run: Any, text: str) -> Any:
    if isinstance(run, str):
        return text
    if "t" in run:
        run["t"] = text
    return run


def runs_to_text(runs: list[Any]) -> str:
    return "".join(_run_text(r) if not _is_ref(r) else f"str. {r['page']}" for r in runs)


# --------------------------------------------------------------------------
# Page model
# --------------------------------------------------------------------------


@dataclass
class Span:
    text: str
    bold: bool
    italic: bool
    size: float
    font: str


@dataclass
class Item:
    kind: str  # "line" | "table" | "image"
    page: int  # pdf page index (0-based)
    bbox: tuple[float, float, float, float]
    col: int = 0  # -1 full width, 0 left, 1 right
    band: int = 0
    spans: list[Span] = field(default_factory=list)
    data: dict[str, Any] = field(default_factory=dict)

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.spans)

    @property
    def size(self) -> float:
        sizes = [s.size for s in self.spans if s.text.strip()]
        return max(sizes) if sizes else 0.0

    @property
    def bold(self) -> bool:
        visible = [s for s in self.spans if s.text.strip() and s.text.strip() != REF_MARK]
        return bool(visible) and all(s.bold for s in visible)

    @property
    def x0(self) -> float:
        return self.bbox[0]

    @property
    def y0(self) -> float:
        return self.bbox[1]

    @property
    def y1(self) -> float:
        return self.bbox[3]


class Extractor:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.doc = pymupdf.open(args.pdf)
        self.page_count = self.doc.page_count if not args.max_pages else min(args.max_pages, self.doc.page_count)
        self.ref_font_re = re.compile(args.ref_font, re.I)
        self.bold_font_re = re.compile(r"bold|black|heavy|semibold|demi", re.I)
        self.italic_font_re = re.compile(r"italic|oblique", re.I)
        self.items: list[Item] = []
        self.printed: dict[int, int] = {}
        self.body_size = 9.0
        self.image_hashes: dict[str, dict[str, Any]] = {}
        self.drawings_cache: dict[int, list[Any]] = {}

    # ---------------------------------------------------------------- reading

    def read_pages(self) -> None:
        raw_lines: list[Item] = []
        for pno in range(self.page_count):
            page = self.doc[pno]
            raw_lines.extend(self._page_lines(page))
        self._strip_margins(raw_lines)
        self._compute_body_size()

    def _page_lines(self, page: Any) -> list[Item]:
        flags = pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_IMAGES
        data = page.get_text("dict", flags=flags)
        lines: list[Item] = []
        for block in data["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                spans: list[Span] = []
                for s in line["spans"]:
                    text = s["text"]
                    if not text:
                        continue
                    font = s.get("font", "")
                    stripped = text.strip()
                    if self.ref_font_re.search(font) and len(stripped) == 1:
                        text = text.replace(stripped, REF_MARK)
                    for arrow in TEXT_ARROWS:
                        text = text.replace(arrow, REF_MARK)
                    bold = bool(s["flags"] & 16) or bool(self.bold_font_re.search(font))
                    italic = bool(s["flags"] & 2) or bool(self.italic_font_re.search(font))
                    spans.append(Span(text, bold, italic, round(s["size"], 1), font))
                if not spans or not "".join(s.text for s in spans).strip():
                    continue
                bbox = tuple(line["bbox"])
                lines.append(Item("line", page.number, bbox, spans=spans))  # type: ignore[arg-type]
        return lines

    def _strip_margins(self, lines: list[Item]) -> None:
        top_frac, bottom_frac = self.args.margin_top, self.args.margin_bottom
        counts: Counter[str] = Counter()
        margin_lines: list[tuple[Item, str]] = []
        for it in lines:
            height = self.doc[it.page].rect.height
            if it.y1 <= height * top_frac or it.y0 >= height * (1 - bottom_frac):
                key = re.sub(r"\d+", "#", clean_text(it.text).lower())
                margin_lines.append((it, key))
        pages_with_key: dict[str, set[int]] = {}
        for it, key in margin_lines:
            pages_with_key.setdefault(key, set()).add(it.page)
        for key, pages in pages_with_key.items():
            counts[key] = len(pages)
        threshold = max(3, int(self.page_count * 0.04))
        outline_titles = {normalize_title(t) for _, t, *_ in self.doc.get_toc()}
        drop: set[int] = set()
        for it, key in margin_lines:
            text = clean_text(it.text)
            number = None
            m = re.fullmatch(r"(\d{1,3})", text) or re.match(r"^(\d{1,3})\s+\D", text) or re.search(r"\D\s+(\d{1,3})$", text)
            if m:
                number = int(m.group(1))
            bare = normalize_title(re.sub(r"\d+", "", text))
            if key == "#" or counts[key] >= threshold or bare in outline_titles:
                drop.add(id(it))
                if number is not None and it.page not in self.printed:
                    self.printed[it.page] = number
        self.items = [it for it in lines if id(it) not in drop]
        self._fill_printed_numbers()

    def _fill_printed_numbers(self) -> None:
        for pno in range(self.page_count):
            label = self.doc[pno].get_label() if hasattr(self.doc[pno], "get_label") else ""
            if label and label.isdigit() and pno not in self.printed:
                self.printed[pno] = int(label)
        deltas = Counter(num - pno for pno, num in self.printed.items())
        delta = deltas.most_common(1)[0][0] if deltas else 1
        for pno in range(self.page_count):
            # Trust only numbers consistent with the dominant offset.
            if self.printed.get(pno) != pno + delta:
                self.printed[pno] = pno + delta

    def _compute_body_size(self) -> None:
        sizes: Counter[float] = Counter()
        for it in self.items:
            for s in it.spans:
                sizes[s.size] += len(s.text.strip())
        if sizes:
            self.body_size = sizes.most_common(1)[0][0]

    # --------------------------------------------------------- tables/images

    def add_tables_and_figures(self, assets_dir: Path | None) -> None:
        by_page: dict[int, list[Item]] = {}
        for it in self.items:
            by_page.setdefault(it.page, []).append(it)
        new_items: list[Item] = []
        for pno in range(self.page_count):
            page = self.doc[pno]
            lines = by_page.get(pno, [])
            tables = self._tables(page) if not self.args.no_tables else []
            figures = self._figures(page, tables, lines) if not self.args.no_images else []
            keep: list[Item] = []
            for ln in lines:
                c = _center(ln.bbox)
                if any(_contains(t.bbox, c) for t in tables):
                    continue
                inside_fig = [f for f in figures if _contains(f.bbox, c)]
                if inside_fig and len(clean_text(ln.text)) <= self.args.callout_max_chars:
                    continue
                keep.append(ln)
            new_items.extend(keep)
            new_items.extend(tables)
            new_items.extend(figures)
        self.items = new_items

    def _tables(self, page: Any) -> list[Item]:
        out: list[Item] = []
        try:
            found = page.find_tables()
        except Exception as exc:  # pragma: no cover - depends on PDF
            print(f"  ! table detection failed on page {page.number + 1}: {exc}", file=sys.stderr)
            return out
        for tab in found.tables:
            rows = tab.extract()
            header_external = bool(getattr(tab.header, "external", False))
            if header_external:
                rows = [list(tab.header.names)] + rows
            rows = [[_clean_cell(c) for c in row] for row in rows]
            rows = [r for r in rows if any(r)]
            if not rows:
                continue
            ncols = max(len(r) for r in rows)
            rows = [r + [""] * (ncols - len(r)) for r in rows]
            non_empty_cols = [i for i in range(ncols) if any(r[i] for r in rows)]
            rows = [[r[i] for i in non_empty_cols] for r in rows]
            if len(non_empty_cols) < 2 or len(rows) < 2:
                continue
            out.append(Item("table", page.number, tuple(tab.bbox), data={"rows": rows}))  # type: ignore[arg-type]
        return out

    def _figures(self, page: Any, tables: list[Item], lines: list[Item]) -> list[Item]:
        rects: list[tuple[pymupdf.Rect, bool]] = []  # (rect, is_raster)
        page_rect = page.rect
        for info in page.get_image_info(xrefs=True):
            r = pymupdf.Rect(info["bbox"]) & page_rect
            if r.is_empty or r.width < self.args.min_icon or r.height < self.args.min_icon:
                continue
            rects.append((r, True))
        if not self.args.no_vector:
            try:
                clusters = page.cluster_drawings(x_tolerance=3, y_tolerance=3)
            except Exception:  # pragma: no cover - older PyMuPDF
                clusters = []
            for r in clusters:
                r = pymupdf.Rect(r) & page_rect
                if r.width < self.args.min_figure or r.height < self.args.min_figure:
                    continue
                if any(_overlap_ratio(r, pymupdf.Rect(t.bbox)) > 0.3 for t in tables):
                    continue
                if self._looks_like_frame(page, r, lines):
                    continue
                rects.append((r, False))
        merged = _merge_rects(rects)
        out: list[Item] = []
        for r, is_raster in merged:
            if not is_raster and self._text_density(r, lines) > 0.25:
                continue
            out.append(Item("image", page.number, (r.x0, r.y0, r.x1, r.y1), data={"raster": is_raster}))
        return out

    def _drawings(self, page: Any) -> list[Any]:
        if page.number not in self.drawings_cache:
            try:
                self.drawings_cache[page.number] = page.get_drawings()
            except Exception:  # pragma: no cover
                self.drawings_cache[page.number] = []
        return self.drawings_cache[page.number]

    def _looks_like_frame(self, page: Any, r: Any, lines: list[Item]) -> bool:
        """Boxes around warnings / text are drawn as rectangles: skip them."""
        items = [d for d in self._drawings(page) if r.contains(pymupdf.Rect(d["rect"]))]
        if not items:
            return True
        kinds = Counter(op[0] for d in items for op in d["items"])
        only_straight = set(kinds) <= {"re", "l", "qu"}
        return only_straight and self._text_density(r, lines) > 0.15

    @staticmethod
    def _text_density(r: Any, lines: list[Item]) -> float:
        area = max(r.width * r.height, 1.0)
        covered = 0.0
        for ln in lines:
            lr = pymupdf.Rect(ln.bbox)
            if r.contains(lr) and len(clean_text(ln.text)) > 12:
                covered += lr.width * lr.height
        return covered / area

    # ---------------------------------------------------------------- layout

    def assign_layout(self) -> None:
        by_page: dict[int, list[Item]] = {}
        for it in self.items:
            by_page.setdefault(it.page, []).append(it)
        ordered: list[Item] = []
        for pno in sorted(by_page):
            width = self.doc[pno].rect.width
            mid = width / 2
            gutter = width * 0.02
            items = by_page[pno]
            for it in items:
                x0, _, x1, _ = it.bbox
                if self.args.single_column:
                    it.col = -1
                elif x0 < mid - gutter and x1 > mid + gutter:
                    it.col = -1
                elif x0 >= mid - gutter:
                    it.col = 1
                else:
                    it.col = 0
            full = sorted((it for it in items if it.col == -1), key=lambda i: i.y0)
            full_ys = [f.y0 for f in full]
            for it in items:
                if it.col == -1:
                    it.band = full.index(it) + 1
                else:
                    it.band = sum(1 for y in full_ys if y < it.y0)
            items.sort(key=lambda i: (i.band, 0 if i.col == -1 else 1, i.col, round(i.y0, 1), i.x0))
            ordered.extend(items)
        self.items = ordered

    # ------------------------------------------------------------- structure

    def outline(self) -> list[dict[str, Any]]:
        toc = self.doc.get_toc(simple=False)
        entries: list[dict[str, Any]] = []
        for lvl, title, pno, dest in toc:
            title = clean_text(title)
            if not title or pno < 1 or pno > self.page_count:
                continue
            to_y = None
            if isinstance(dest, dict) and dest.get("to") is not None:
                try:
                    to_y = float(dest["to"].y)
                except Exception:
                    to_y = None
            entries.append({"level": lvl, "title": title, "page": pno - 1, "y": to_y})
        if entries:
            return entries
        print("  ! PDF has no outline, falling back to font-size headings", file=sys.stderr)
        return self._outline_from_headings()

    def _outline_from_headings(self) -> list[dict[str, Any]]:
        sizes = sorted({it.size for it in self.items if it.kind == "line" and it.size >= self.body_size * 1.3}, reverse=True)
        level_of = {s: (1 if i == 0 else 2) for i, s in enumerate(sizes)}
        entries = []
        for it in self.items:
            if it.kind == "line" and it.size in level_of and len(clean_text(it.text)) < 90:
                entries.append({"level": level_of[it.size], "title": clean_text(it.text.replace(REF_MARK, "")), "page": it.page, "y": it.y0})
        return entries

    def locate_entries(self, entries: list[dict[str, Any]]) -> list[int]:
        """Find the item index where each outline entry starts (monotonic)."""
        positions: list[int] = []
        start = 0
        page_first: dict[int, int] = {}
        for idx, it in enumerate(self.items):
            page_first.setdefault(it.page, idx)
        for e in entries:
            target = normalize_title(e["title"])
            found = None
            idx = start
            while idx < len(self.items) and self.items[idx].page <= e["page"] + 1:
                it = self.items[idx]
                if it.kind == "line" and it.page >= e["page"] - 1:
                    combined = ""
                    for k in range(3):
                        if idx + k >= len(self.items) or self.items[idx + k].kind != "line":
                            break
                        prev, sep = join_line_texts(combined, self.items[idx + k].text) if combined else ("", "")
                        combined = prev + sep + self.items[idx + k].text
                        if normalize_title(combined) == target:
                            found = idx
                            e["span"] = k + 1
                            break
                    if found is not None:
                        break
                idx += 1
            if found is None:
                # Fall back to the outline destination.
                candidates = [
                    i for i in range(start, len(self.items))
                    if self.items[i].page == e["page"] and (e["y"] is None or self.items[i].y1 >= e["y"] - 2)
                ]
                found = candidates[0] if candidates else page_first.get(e["page"], start)
                found = max(found, start)
                e["span"] = 0
            positions.append(found)
            start = found
        return positions

    # -------------------------------------------------------------- assembly

    def is_heading(self, it: Item) -> int | None:
        text = clean_text(it.text.replace(REF_MARK, ""))
        if not text or len(text) > 90 or text.endswith((",", ";")):
            return None
        if text.lower().rstrip(":") in WARNING_LABELS:
            return None
        if BULLET_RE.match(text) or ORDERED_RE.match(text):
            return None
        size = it.size
        if size >= self.body_size * 1.3:
            return 2
        if it.bold and size >= self.body_size * 1.08:
            return 3
        if it.bold and not text.endswith(".") and size >= self.body_size * 0.98 and re.search(r"[A-Za-zÀ-ž]", text):
            return 4
        return None


def _clean_cell(c: Any) -> str:
    if c is None:
        return ""
    text = str(c)
    parts = text.split("\n")
    out = parts[0]
    for nxt in parts[1:]:
        prev, sep = join_line_texts(out, nxt)
        out = prev + sep + nxt.strip()
    return clean_text(out.replace(REF_MARK, "⇒"))


def _center(b: tuple[float, float, float, float]) -> tuple[float, float]:
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def _contains(b: tuple[float, float, float, float], p: tuple[float, float]) -> bool:
    return b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3]


def _overlap_ratio(a: Any, b: Any) -> float:
    inter = a & b
    if inter.is_empty:
        return 0.0
    return (inter.width * inter.height) / max(min(a.width * a.height, b.width * b.height), 1.0)


def _merge_rects(rects: list[tuple[Any, bool]]) -> list[tuple[Any, bool]]:
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


# --------------------------------------------------------------------------
# Section builder
# --------------------------------------------------------------------------


class SectionBuilder:
    """Turns a slice of items into content blocks for one section page."""

    def __init__(self, ex: Extractor, section: dict[str, Any], assets_dir: Path | None, assets_url: str) -> None:
        self.ex = ex
        self.section = section
        self.assets_dir = assets_dir
        self.assets_url = assets_url
        self.blocks: list[dict[str, Any]] = []
        self.counter = 0
        self.para: list[Item] = []
        self.list: dict[str, Any] | None = None
        self.warning: dict[str, Any] | None = None
        self.last_line: Item | None = None

    def next_id(self) -> str:
        self.counter += 1
        return f"b{self.counter}"

    def page_of(self, it: Item) -> int:
        return self.ex.printed.get(it.page, it.page + 1)

    # ----------------------------------------------------------------- feed

    def heading(self, text_items: list[Item], level: int) -> None:
        self.flush_all()
        runs = self._runs(text_items)
        if runs:
            for r in runs:
                if isinstance(r, dict):
                    r.pop("b", None)
            runs = [r["t"] if isinstance(r, dict) and set(r) == {"t"} else r for r in runs]
            self.blocks.append({"type": "heading", "id": self.next_id(), "level": max(2, min(level, 4)), "runs": runs, "page": self.page_of(text_items[0])})

    def feed(self, it: Item) -> None:
        if it.kind == "table":
            self.flush_all()
            self.blocks.append({"type": "table", "id": self.next_id(), "header": True, "rows": it.data["rows"], "page": self.page_of(it)})
            return
        if it.kind == "image":
            rect = self.warning.get("rect") if self.warning else None
            is_icon = max(it.bbox[2] - it.bbox[0], it.bbox[3] - it.bbox[1]) < self.ex.args.icon_size
            if rect is not None and is_icon and _contains(rect, _center(it.bbox)):
                return  # decorative pictogram inside a warning box
            self.flush_all()
            block = self._image_block(it, is_icon)
            if block:
                self.blocks.append(block)
            return
        self._line(it)

    def _line(self, it: Item) -> None:
        text = clean_text(it.text)
        label = self._warning_label(it)
        if label:
            kind, title, rest = label
            self.flush_all()
            self.warning = {
                "kind": kind,
                "title": title,
                "blocks": [],
                "page": self.page_of(it),
                "rect": self._warning_rect(it),
                "anchor": it,
                "lines": 0,
            }
            if rest:
                self._line(Item("line", it.page, it.bbox, it.col, it.band, rest))
            return
        if self.warning is not None and not self._belongs_to_warning(it):
            self.close_warning()
        if self.warning is None:
            level = self.ex.is_heading(it)
            if level is not None:
                self.heading([it], level)
                self.last_line = it
                return
        if self.warning is not None:
            self.warning["lines"] += 1
        bullet = BULLET_RE.match(text)
        ordered = ORDERED_RE.match(text)
        if bullet or ordered:
            self.flush_para()
            is_ordered = bool(ordered and not bullet)
            if self.list is None or self.list["ordered"] != is_ordered:
                self.flush_list()
                self.list = {"ordered": is_ordered, "items": [], "page": self.page_of(it), "x": it.x0}
            self.list["items"].append([self._strip_marker(it)])
            self.last_line = it
            return
        if self.list is not None and self.list["items"] and self._continues(it, list_mode=True):
            self.list["items"][-1].append(it)
            self.last_line = it
            return
        self.flush_list()
        if self.para and not self._continues(it, list_mode=False):
            self.flush_para()
        self.para.append(it)
        self.last_line = it

    # -------------------------------------------------------------- helpers

    def _warning_label(self, it: Item) -> tuple[str, str, list[Span]] | None:
        text = clean_text(it.text.replace(REF_MARK, ""))
        key = text.lower().rstrip(":").strip()
        if key in WARNING_LABELS:
            kind, title = WARNING_LABELS[key]
            return kind, title, []
        first = next((s for s in it.spans if s.text.strip()), None)
        if first and first.bold:
            head = first.text.strip().lower().rstrip(":")
            if head in WARNING_LABELS and len(text) > len(head) + 1:
                kind, title = WARNING_LABELS[head]
                idx = it.spans.index(first)
                return kind, title, it.spans[idx + 1 :]
        return None

    def _warning_rect(self, it: Item) -> tuple[float, float, float, float] | None:
        page = self.ex.doc[it.page]
        best = None
        lr = pymupdf.Rect(it.bbox)
        for d in self.ex._drawings(page):
            r = pymupdf.Rect(d["rect"])
            if r.width < 60 or r.height < lr.height * 2:
                continue
            if r.contains(lr) and (best is None or r.width * r.height < best.width * best.height):
                best = r
        return (best.x0, best.y0, best.x1, best.y1) if best is not None else None

    def _belongs_to_warning(self, it: Item) -> bool:
        assert self.warning is not None
        rect = self.warning["rect"]
        if rect is not None:
            return it.page == self.warning["anchor"].page and _contains(rect, _center(it.bbox))
        prev = self.last_line or self.warning["anchor"]
        if self.ex.is_heading(it) is not None and self.warning["lines"] > 0:
            return False
        if it.page != prev.page or it.col != prev.col or it.band != prev.band:
            return not clean_text(self._joined_text(prev)).endswith(SENTENCE_END)
        gap = it.y0 - prev.y1
        if not self.warning["lines"]:
            return gap < self.ex.body_size * 2.5
        # Unframed notes ("Uwaga") end with their paragraph.
        factor = self.ex.args.para_gap if self.warning["kind"] == "note" else self.ex.args.warning_gap
        return gap < self.ex.body_size * factor

    def _continues(self, it: Item, list_mode: bool) -> bool:
        prev = self.last_line
        if prev is None:
            return False
        if it.page == prev.page and it.col == prev.col and it.band == prev.band:
            gap = it.y0 - prev.y1
            if gap >= self.ex.body_size * self.ex.args.para_gap:
                return False
            if list_mode:
                return self.list is not None and it.x0 > self.list["x"] + 2
            return True
        # Column / page break: join when the sentence is clearly unfinished.
        prev_text = clean_text(self._joined_text(prev))
        nxt = clean_text(it.text)
        unfinished = not prev_text.endswith(SENTENCE_END)
        return unfinished and nxt[:1].islower()

    @staticmethod
    def _joined_text(it: Item) -> str:
        return it.text

    def _strip_marker(self, it: Item) -> Item:
        spans = [Span(s.text, s.bold, s.italic, s.size, s.font) for s in it.spans]
        for s in spans:
            if not s.text.strip():
                continue
            m = BULLET_RE.match(s.text.lstrip()) or ORDERED_RE.match(s.text.lstrip())
            if m:
                s.text = s.text.lstrip()[m.end() :]
            elif s.text.strip() in "■●•▪◆○◦–—-":
                s.text = ""
            break
        return Item("line", it.page, it.bbox, it.col, it.band, spans)

    def _runs(self, lines: list[Item]) -> list[Any]:
        chars: list[tuple[str, bool, bool]] = []
        for ln in lines:
            line_chars: list[tuple[str, bool, bool]] = []
            for s in ln.spans:
                line_chars.extend((ch, s.bold, s.italic) for ch in s.text)
            line_text = "".join(c for c, _, _ in line_chars)
            if chars:
                prev_text = "".join(c for c, _, _ in chars)
                fixed, sep = join_line_texts(prev_text, line_text)
                chars = chars[: len(fixed)]
                if sep:
                    chars.append((sep, False, False))
                lead = len(line_text) - len(line_text.lstrip())
                line_chars = line_chars[lead:]
            chars.extend(line_chars)
        chars = [(unicodedata.normalize("NFC", c), b, i) for c, b, i in chars]
        return build_runs(chars)

    def flush_para(self) -> None:
        if not self.para:
            return
        runs = self._runs(self.para)
        if runs:
            block = {"type": "paragraph", "id": "", "runs": runs, "page": self.page_of(self.para[0])}
            self._append(block)
        self.para = []

    def flush_list(self) -> None:
        if not self.list:
            return
        items = [self._runs(lines) for lines in self.list["items"]]
        items = [i for i in items if i]
        if items:
            self._append({"type": "list", "id": "", "ordered": self.list["ordered"], "items": items, "page": self.list["page"]})
        self.list = None

    def flush_para_list(self) -> None:
        self.flush_para()
        self.flush_list()

    def _append(self, block: dict[str, Any]) -> None:
        if self.warning is not None:
            self.warning["blocks"].append(block)
        else:
            block["id"] = self.next_id()
            self.blocks.append(block)

    def close_warning(self) -> None:
        if self.warning is None:
            return
        self.flush_para_list()
        w = self.warning
        self.warning = None
        wid = self.next_id()
        inner = []
        for n, b in enumerate(w["blocks"], start=1):
            b["id"] = f"{wid}-{n}"
            inner.append(b)
        self.blocks.append({"type": "warning", "id": wid, "kind": w["kind"], "title": w["title"], "blocks": inner, "page": w["page"]})

    def flush_all(self) -> None:
        self.flush_para_list()
        self.close_warning()

    def finish(self) -> list[dict[str, Any]]:
        self.flush_all()
        return self.blocks

    # ---------------------------------------------------------------- images

    def _image_block(self, it: Item, is_icon: bool) -> dict[str, Any] | None:
        if self.assets_dir is None:
            return None
        page = self.ex.doc[it.page]
        rect = pymupdf.Rect(it.bbox)
        dpi = self.ex.args.icon_dpi if is_icon else self.ex.args.dpi
        try:
            pix = page.get_pixmap(clip=rect, dpi=dpi, alpha=False)
        except Exception as exc:  # pragma: no cover
            print(f"  ! cannot render image on page {it.page + 1}: {exc}", file=sys.stderr)
            return None
        digest = hashlib.sha1(pix.samples).hexdigest()
        printed = self.page_of(it)
        alt_base = self.section["title"]
        if digest in self.ex.image_hashes:
            known = self.ex.image_hashes[digest]
            return {"type": "image", "id": self.next_id(), "src": known["src"], "width": known["width"], "height": known["height"], "alt": f"Ilustracja: {alt_base} (str. {printed})", **({"icon": True} if is_icon else {}), "page": printed}
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        max_w = self.ex.args.max_width
        if img.width > max_w:
            img = img.resize((max_w, round(img.height * max_w / img.width)), Image.Resampling.LANCZOS)
        if _is_grayscale(img):
            img = img.convert("L")
        chapter = self.section["chapter_slug"]
        n = sum(1 for v in self.ex.image_hashes.values() if v["chapter"] == chapter) + 1
        name = f"p{printed:03d}-{n:02d}.webp"
        target = self.assets_dir / chapter / name
        target.parent.mkdir(parents=True, exist_ok=True)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=self.ex.args.quality, method=6)
        target.write_bytes(buf.getvalue())
        src = f"{self.assets_url}/{chapter}/{name}"
        self.ex.image_hashes[digest] = {"src": src, "width": img.width, "height": img.height, "chapter": chapter}
        block = {"type": "image", "id": self.next_id(), "src": src, "width": img.width, "height": img.height, "alt": f"Ilustracja: {alt_base} (str. {printed})", "page": printed}
        if is_icon:
            block["icon"] = True
        return block


def _is_grayscale(img: Image.Image) -> bool:
    small = img.resize((min(64, img.width), min(64, img.height)))
    for r, g, b in small.convert("RGB").get_flattened_data() if hasattr(small, "get_flattened_data") else small.getdata():
        if abs(r - g) > 12 or abs(g - b) > 12 or abs(r - b) > 12:
            return False
    return True


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------


def build(args: argparse.Namespace) -> dict[str, Any]:
    out_dir = Path(args.out)
    assets_dir = None if args.no_images else Path(args.assets)
    ex = Extractor(args)
    print(f"→ {args.pdf}: {ex.page_count} pages")
    ex.read_pages()
    print(f"  body font size: {ex.body_size}")
    ex.add_tables_and_figures(assets_dir)
    ex.assign_layout()

    entries = ex.outline()
    positions = ex.locate_entries(entries)
    skip_re = re.compile(args.skip_title, re.I) if args.skip_title else None

    # Prepare output folders (generated content is fully replaced).
    if out_dir.exists():
        for f in out_dir.glob("*.json"):
            f.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)
    if assets_dir is not None:
        if assets_dir.exists():
            shutil.rmtree(assets_dir)
        assets_dir.mkdir(parents=True, exist_ok=True)

    sections: list[dict[str, Any]] = []
    chapters: dict[str, dict[str, Any]] = {}
    stack: list[dict[str, Any]] = []  # page-level sections by level
    used_slugs: dict[str | None, set[str]] = {}
    skip_level: int | None = None
    current: dict[str, Any] | None = None
    builder: SectionBuilder | None = None

    def finish_current() -> None:
        if builder is not None and current is not None:
            chapters[current["chapter_slug"]]["sections"][current["id"]] = builder.finish()

    bounds = positions + [len(ex.items)]
    for n, e in enumerate(entries):
        start, end = positions[n], max(positions[n], bounds[n + 1])
        if skip_level is not None and e["level"] > skip_level:
            continue
        skip_level = None
        if skip_re and skip_re.search(e["title"]):
            skip_level = e["level"]
            finish_current()
            current, builder = None, None
            continue
        title_span = e.get("span", 0)
        if e["level"] <= args.max_page_level or current is None:
            finish_current()
            level = min(e["level"], args.max_page_level)
            while stack and stack[-1]["level"] >= level:
                stack.pop()
            parent = stack[-1] if stack else None
            if parent is None and level > 1:
                level = 1
            parent_id = parent["id"] if parent else None
            siblings = used_slugs.setdefault(parent_id, set())
            base = slugify(e["title"])
            slug = base
            k = 2
            while slug in siblings:
                slug = f"{base}-{k}"
                k += 1
            siblings.add(slug)
            path = (parent["slug"] if parent else []) + [slug]
            chapter_slug = path[0]
            current = {
                "id": "/".join(path),
                "slug": path,
                "title": e["title"],
                "level": level,
                "parentId": parent_id,
                "page": ex.printed.get(e["page"], e["page"] + 1),
                "file": f"{chapter_slug}.json",
                "chapter_slug": chapter_slug,
            }
            sections.append(current)
            stack.append(current)
            chapters.setdefault(chapter_slug, {"formatVersion": FORMAT_VERSION, "sections": {}})
            builder = SectionBuilder(ex, current, assets_dir, args.assets_url)
        else:
            assert builder is not None
            heading_items = [it for it in ex.items[start : start + title_span] if it.kind == "line"]
            if heading_items:
                builder.heading(heading_items, e["level"] - args.max_page_level + 1)
            else:
                builder.heading([Item("line", e["page"], (0, 0, 0, 0), spans=[Span(e["title"], True, False, ex.body_size, "")])], e["level"] - args.max_page_level + 1)
        for it in ex.items[start + title_span : end]:
            builder.feed(it)
    finish_current()

    for slug, data in chapters.items():
        (out_dir / f"{slug}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    index = {
        "formatVersion": FORMAT_VERSION,
        "id": args.book,
        "title": args.title,
        "source": {
            "url": args.source_url,
            "file": Path(args.pdf).name,
            "extractedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "pages": ex.page_count,
        },
        "sections": [{k: v for k, v in s.items() if k != "chapter_slug"} for s in sections],
    }
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    images = len(ex.image_hashes)
    print(f"  sections: {len(sections)}, chapters: {len(chapters)}, unique images: {images}")
    return index


def book_id(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", value):
        raise argparse.ArgumentTypeError("book id must be a lowercase slug (a-z, 0-9, -)")
    return value


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--book", required=True, type=book_id, help="book id (lowercase slug), also the output directory name")
    p.add_argument("--pdf", required=True)
    p.add_argument("--out", required=True, help="output directory for JSON")
    p.add_argument("--assets", required=True, help="output directory for WebP images")
    p.add_argument("--assets-url", required=True, help="public URL prefix of --assets")
    p.add_argument("--title", required=True)
    p.add_argument("--source-url", default="")
    p.add_argument("--max-page-level", type=int, default=2, help="outline levels rendered as separate pages")
    p.add_argument("--skip-title", default=r"^(spis treści|skorowidz|indeks)$")
    p.add_argument("--ref-font", default=r"symbol|dingbat|wingding|pictogram|arrow|opelsym|opel-sym")
    p.add_argument("--margin-top", type=float, default=0.07)
    p.add_argument("--margin-bottom", type=float, default=0.07)
    p.add_argument("--para-gap", type=float, default=0.45, help="vertical gap (× body size) that starts a new paragraph")
    p.add_argument("--warning-gap", type=float, default=1.2, help="vertical gap (× body size) that ends an unframed warning")
    p.add_argument("--single-column", action="store_true")
    p.add_argument("--dpi", type=int, default=144)
    p.add_argument("--icon-dpi", type=int, default=192)
    p.add_argument("--icon-size", type=float, default=30.0, help="figures smaller than this (pt) are icons")
    p.add_argument("--min-icon", type=float, default=6.0)
    p.add_argument("--min-figure", type=float, default=36.0)
    p.add_argument("--callout-max-chars", type=int, default=12)
    p.add_argument("--max-width", type=int, default=1200)
    p.add_argument("--quality", type=int, default=78)
    p.add_argument("--no-images", action="store_true")
    p.add_argument("--no-vector", action="store_true", help="only extract raster images")
    p.add_argument("--no-tables", action="store_true")
    p.add_argument("--max-pages", type=int, default=0, help="debug: only process the first N pages")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not Path(args.pdf).exists():
        print(f"PDF not found: {args.pdf}. Run `pnpm fetch-manuals` first.", file=sys.stderr)
        return 1
    build(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
