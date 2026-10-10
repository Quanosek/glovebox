"""Reading pages: characters with font, size, baseline and "fake bold";
symbol fonts; lone markers joined with their text; running headers and
printed page numbers."""

from __future__ import annotations

import bisect
import re
from collections import Counter
from typing import Any

from .document import Document
from .model import Item, Span
from .pdf import pymupdf
from .text import MARKER_ONLY_RE, REF_MARK, TEXT_ARROWS, clean_text, normalize_title


def read_pages(doc: Document) -> None:
    pages = [page_lines(doc, doc.pdf[pno]) for pno in range(doc.page_count)]
    classify_symbol_fonts(doc, [ln for lines in pages for ln in lines])
    raw_lines: list[Item] = []
    for lines in pages:
        raw_lines.extend(merge_markers(lines))
    strip_margins(doc, raw_lines)
    compute_body_size(doc)
    measure_word_spaces(doc)


def stroked_glyphs(page: Any) -> dict[int, list[float]]:
    """Origins of glyphs that are also stroked: the "fake bold" used by
    many publishing tools (text filled and then outlined)."""
    out: dict[int, list[float]] = {}
    try:
        trace = page.get_texttrace()
    except Exception:  # pragma: no cover - depends on PDF
        return out
    for span in trace:
        if span.get("type") != 1:  # 1 = stroked text
            continue
        for ch in span["chars"]:
            x, y = ch[2]
            out.setdefault(round(y), []).append(x)
    for xs in out.values():
        xs.sort()
    return out


def is_stroked(stroked: dict[int, list[float]], x: float, y: float) -> bool:
    for key in (round(y), round(y) - 1, round(y) + 1):
        xs = stroked.get(key)
        if not xs:
            continue
        k = bisect.bisect_left(xs, x - 0.3)
        if k < len(xs) and abs(xs[k] - x) <= 0.3:
            return True
    return False


def page_lines(doc: Document, page: Any) -> list[Item]:
    flags = pymupdf.TEXTFLAGS_RAWDICT & ~pymupdf.TEXT_PRESERVE_IMAGES
    data = page.get_text("rawdict", flags=flags)
    stroked = stroked_glyphs(page)
    lines: list[Item] = []
    for block in data["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            # A wide horizontal gap splits one PDF line into separate
            # items (cells of a table, text beside a label).
            segments: list[dict[str, Any]] = []
            seg: dict[str, Any] | None = None
            last_x1: float | None = None
            for s in line["spans"]:
                font = s.get("font", "")
                size = round(s["size"], 1)
                font_bold = bool(s["flags"] & 16) or bool(doc.bold_font_re.search(font))
                italic = bool(s["flags"] & 2) or bool(doc.italic_font_re.search(font))
                for ch in s["chars"]:
                    c = ch["c"]
                    if not c:
                        continue
                    cb = tuple(ch["bbox"])
                    ox, oy = ch["origin"]
                    if c.strip() and seg is not None and last_x1 is not None and cb[0] - last_x1 > max(size * 1.6, 10):
                        seg = None
                    if seg is None:
                        seg = {"spans": [], "bbox": None, "base": None, "xs": [], "glyphs": []}
                        segments.append(seg)
                    if c.strip():
                        last_x1 = cb[2]
                        if seg["base"] is None:
                            seg["base"] = oy
                        b = seg["bbox"]
                        seg["bbox"] = cb if b is None else (min(b[0], cb[0]), min(b[1], cb[1]), max(b[2], cb[2]), max(b[3], cb[3]))
                    bold = font_bold or (bool(stroked) and is_stroked(stroked, ox, oy))
                    if c in TEXT_ARROWS:
                        c = REF_MARK
                    seg["xs"].append(cb[0])
                    if c.strip():
                        seg["glyphs"].append((size, oy))
                    spans: list[Span] = seg["spans"]
                    last = spans[-1] if spans else None
                    if last is not None and last.font == font and last.size == size and last.italic == italic and (last.bold == bold or not c.strip()):
                        last.text += c
                        assert last.bbox is not None
                        last.bbox = (min(last.bbox[0], cb[0]), min(last.bbox[1], cb[1]), max(last.bbox[2], cb[2]), max(last.bbox[3], cb[3]))
                    else:
                        spans.append(Span(c, bold, italic, size, font, cb))  # type: ignore[arg-type]
            for sg in segments:
                if sg["bbox"] is None or not "".join(x.text for x in sg["spans"]).strip():
                    continue
                lb = line["bbox"]
                bbox = (sg["bbox"][0], lb[1], sg["bbox"][2], lb[3]) if len(segments) > 1 else tuple(lb)
                # Left edge of every character, to split a line into table cells.
                data: dict[str, Any] = {"char_x": sg["xs"], **script_shift(sg["glyphs"], sg["base"])}
                if len(segments) > 1:
                    data["line_x"] = (lb[0], lb[2])
                mark_scripts(sg["spans"], sg["base"])
                lines.append(Item("line", page.number, bbox, spans=sg["spans"], data=data, base=sg["base"]))  # type: ignore[arg-type]
    return lines


def merge_markers(lines: list[Item]) -> list[Item]:
    """Join a lone bullet / step number / legend number / pictogram with
    the text line beside it."""
    drop: set[int] = set()
    for marker in lines:
        if id(marker) in drop:
            continue
        label = clean_text(marker.text)
        bare_number = bool(re.fullmatch(r"\d{1,2}", label))
        pictogram = all(sp.icon for sp in marker.spans if sp.text.strip())
        if not (MARKER_ONLY_RE.match(label) or bare_number or pictogram):
            continue
        best = None
        for other in lines:
            if other is marker or id(other) in drop:
                continue
            if bare_number and not clean_text(other.text)[:1].isupper():
                continue
            gap = other.x0 - marker.x1
            tolerance = 4.0 if pictogram else 2.5
            if 0 <= gap < 16 and abs(other.base - marker.base) < tolerance:
                if best is None or other.x0 < best.x0:
                    best = other
        if best is None:
            continue
        marker_xs = marker.data.get("char_x")
        best_xs = best.data.get("char_x")
        if marker_xs is not None and best_xs is not None and len(marker_xs) == len(marker.text) and len(best_xs) == len(best.text):
            best.data["char_x"] = marker_xs + [marker.x1] + best_xs
        else:
            best.data.pop("char_x", None)
        best.spans = [Span(s.text, s.bold, s.italic, s.size, s.font, s.bbox, s.icon) for s in marker.spans] + [Span(" ", False, False, best.size, "", None)] + best.spans
        best.bbox = (marker.x0, min(marker.y0, best.y0), best.x1, max(marker.y1, best.y1))
        drop.add(id(marker))
    return [ln for ln in lines if id(ln) not in drop]


def classify_symbol_fonts(doc: Document, lines: list[Item]) -> None:
    """Fonts that only draw single glyphs (arrows, button pictograms,
    warning triangles) are symbol fonts. A symbol glyph followed by a
    number is a page reference, every other one an inline pictogram."""
    chars: Counter[str] = Counter()
    spans_total: Counter[str] = Counter()
    spans_short: Counter[str] = Counter()
    for it in lines:
        for s in it.spans:
            visible = s.text.strip()
            if not visible:
                continue
            chars[s.font] += len(visible)
            spans_total[s.font] += 1
            if len(visible) <= 2:
                spans_short[s.font] += 1
    body_font = chars.most_common(1)[0][0] if chars else ""
    symbol_fonts = {
        f for f, n in spans_total.items()
        if f != body_font and (spans_short[f] >= n * 0.9 or doc.ref_font_re.search(f))
    }
    for it in lines:
        for k, s in enumerate(it.spans):
            visible = s.text.strip()
            if s.font not in symbol_fonts or not visible or len(visible) > 3:
                continue
            after = "".join(x.text for x in it.spans[k + 1 :]).lstrip()
            if re.match(r"\d", after) and len(visible) == 1:
                s.text = s.text.replace(visible, REF_MARK)
            elif s.bbox is not None:
                s.icon = True
                s.bold = False


def strip_margins(doc: Document, lines: list[Item]) -> None:
    counts: Counter[str] = Counter()
    margin_lines: list[tuple[Item, str]] = []
    limits = {pno: doc.rule_limits(pno) for pno in range(doc.page_count)}
    for it in lines:
        top, bottom = limits[it.page]
        if it.y1 <= top or it.y0 >= bottom:
            key = re.sub(r"\d+", "#", clean_text(it.text).lower())
            margin_lines.append((it, key))
    pages_with_key: dict[str, set[int]] = {}
    for it, key in margin_lines:
        pages_with_key.setdefault(key, set()).add(it.page)
    for key, pages in pages_with_key.items():
        counts[key] = len(pages)
    threshold = max(3, int(doc.page_count * 0.04))
    outline_titles = {normalize_title(t) for _, t, *_ in doc.pdf.get_toc()}
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
            if number is not None and it.page not in doc.printed:
                doc.printed[it.page] = number
    doc.items = [it for it in lines if id(it) not in drop]
    fill_printed_numbers(doc)


def fill_printed_numbers(doc: Document) -> None:
    for pno in range(doc.page_count):
        label = doc.pdf[pno].get_label() if hasattr(doc.pdf[pno], "get_label") else ""
        if label and label.isdigit() and pno not in doc.printed:
            doc.printed[pno] = int(label)
    deltas = Counter(num - pno for pno, num in doc.printed.items())
    delta = deltas.most_common(1)[0][0] if deltas else 1
    for pno in range(doc.page_count):
        # Trust only numbers consistent with the dominant offset.
        if doc.printed.get(pno) != pno + delta:
            doc.printed[pno] = pno + delta


def compute_body_size(doc: Document) -> None:
    sizes: Counter[float] = Counter()
    for it in doc.items:
        for s in it.spans:
            sizes[s.size] += len(s.text.strip())
    if sizes:
        doc.body_size = sizes.most_common(1)[0][0]


def measure_word_spaces(doc: Document) -> None:
    """Learn ordinary word spacing per font and size, not a fixed PDF unit."""
    widths: dict[tuple[str, float], Counter[float]] = {}
    for it in doc.items:
        xs = it.data.get("char_x", [])
        if len(xs) != len(it.text):
            continue
        pos = 0
        for span in it.spans:
            key = (span.font, span.size)
            for k, ch in enumerate(span.text):
                i = pos + k
                if ch == " " and i + 1 < len(xs) and not it.text[i + 1].isspace():
                    gap = xs[i + 1] - xs[i]
                    if 0 < gap < span.size * 0.8:
                        widths.setdefault(key, Counter())[round(gap, 1)] += 1
            pos += len(span.text)
    spaces = {key: counts.most_common(1)[0][0] for key, counts in widths.items()}
    for it in doc.items:
        ordinary = [s for s in it.spans if s.text.strip() and not s.icon]
        if ordinary:
            span = max(ordinary, key=lambda s: len(s.text))
            it.data["space_width"] = spaces.get((span.font, span.size), span.size * 0.28)


def script_shift(glyphs: list[tuple[float, float]], base: float) -> dict[str, float]:
    """How far subscripts ("CO2") reach below and superscripts above the
    baseline; typesetters add that much to the line spacing."""
    if not glyphs:
        return {}
    main = max(size for size, _ in glyphs)
    small = [oy - base for size, oy in glyphs if size < main * 0.85]
    drop = max([d for d in small if d > 0.5], default=0.0)
    rise = max([-d for d in small if d < -0.5], default=0.0)
    return {k: v for k, v in (("sub_drop", drop), ("sup_rise", rise)) if v}


SUPERSCRIPT = str.maketrans("0123456789()+-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁽⁾⁺⁻")
SUBSCRIPT = str.maketrans("0123456789()+-", "₀₁₂₃₄₅₆₇₈₉₍₎₊₋")


def mark_scripts(spans: list[Span], base: float) -> None:
    """Small raised / lowered digits ("cm3", "CO2", footnote "1)") become
    Unicode super- / subscripts, so they do not merge with the text."""
    sizes = [sp.size for sp in spans if sp.text.strip()]
    if not sizes:
        return
    main = max(sizes)
    for sp in spans:
        if sp.bbox is None or sp.size >= main * 0.85 or not re.fullmatch(r"[\d()+\-]+", sp.text.strip()):
            continue
        if sp.bbox[3] < base - 0.5:
            sp.text = sp.text.translate(SUPERSCRIPT)
        elif sp.bbox[3] > base + 0.5 and sp.bbox[1] > base - main * 0.6:
            sp.text = sp.text.translate(SUBSCRIPT)
