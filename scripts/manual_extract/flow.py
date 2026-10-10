"""Rules deciding whether a line continues the current warning, paragraph or
list item (across columns and pages too), and list marker removal."""

from __future__ import annotations

import re
from typing import Any

from .document import Document
from .headings import is_heading
from .model import Item
from .text import BULLET_RE, ORDERED_RE, REF_MARK, SENTENCE_END, clean_text


def belongs_to_warning(doc: Document, warning: dict[str, Any], prev: Item, it: Item) -> bool:
    """True when `it` is still part of the open warning. A box broken across
    columns or pages moves the warning to the continuation box."""
    frame = it.data.get("frame")
    if warning["frame"] is not None:
        if frame == warning["frame"]:
            return True
        # A box broken across columns or pages continues in an unlabeled
        # box at the top of the next column.
        moved = it.page != prev.page or it.col != prev.col
        if frame is not None and frame not in doc.labeled_frames and moved and prev.data.get("frame") == warning["frame"]:
            warning["frame"] = frame
            warning["page_index"] = it.page
            return True
        return False
    if frame is not None and frame != prev.data.get("frame"):
        # The label sits on a bar just above the box it starts.
        anchor = warning["anchor"]
        if not warning["lines"] and prev is anchor and frame not in doc.labeled_frames and it.page == anchor.page and it.col == anchor.col:
            box = doc.frames[frame[0]][frame[1]]
            if -2 <= box.y0 - anchor.y1 <= anchor.size * 2 and box.x0 - 4 <= anchor.x0 <= box.x1:
                warning["frame"] = frame
                return True
        return False
    if is_heading(doc, it) is not None and warning["lines"] > 0:
        return False
    indent = warning["indent"]
    if indent >= 2.5:
        # Notes set off by indentation end where the text returns to the
        # column edge (in this or in the next column). A note made of a list
        # keeps its bullets, which are indented less than the label.
        if not warning["lines"] and BULLET_RE.match(clean_text(it.text)) and it.x0 >= it.col_x0 + 2:
            warning["list_note"] = True
        edge = it.col_x0 + (2 if warning.get("list_note") else indent - 1.5)
        if it.x0 < edge:
            return False
        return it.page != prev.page or it.col != prev.col or it.base - prev.base < doc.pitch * 3
    if it.page != prev.page or it.col != prev.col or it.band != prev.band:
        return not clean_text(prev.text).endswith(SENTENCE_END)
    delta = it.base - prev.base
    if delta <= 0:
        return False
    if not warning["lines"]:
        return delta < doc.pitch + doc.body_size * 2.5
    # Unframed notes ("Uwaga") end with their paragraph.
    if warning["kind"] == "note":
        return not doc.para_break(prev, it)
    return delta <= doc.pitch + doc.body_size * doc.args.warning_gap


def continues(
    doc: Document, prev: Item | None, it: Item, list_x: float | None, in_warning: bool, list_mode: bool, item_x: float | None = None, flush: bool = False
) -> bool:
    """True when `it` continues the paragraph (or, with `list_mode`, the list
    item whose text starts `list_x` points from the column edge) of `prev`.
    `item_x` is the offset of the first line of the current list item; `flush`
    marks a bulleted list without hanging indents (`Document.flush_bullets`)."""
    if prev is None:
        return False
    if not in_warning and it.data.get("frame") != prev.data.get("frame"):
        return False
    indented = list_x is not None and it.x0 - it.col_x0 > list_x + 2
    if flush and indented:
        # Without hanging indents only an indent the width of the bullet
        # continues the item; a deeper one is a box beside the list.
        start = item_x if item_x is not None else list_x
        indented = it.x0 - it.col_x0 - start <= max(12.0, it.size * 2)
    if it.page == prev.page and it.col == prev.col and it.band == prev.band:
        if abs(it.base - prev.base) < 1 and it.x0 >= prev.x1 - 1 and split_at_pictogram(prev, it):
            return True  # the rest of one line split at a wide gap (a pictogram)
        if list_mode:
            # Indented paragraphs below a bullet belong to the same item.
            if indented and it.base - prev.base < doc.pitch * 2.5:
                return True
            # Without a hanging indent the wrapped lines start under the bullet.
            if not flush or doc.para_break(prev, it):
                return False
            aligned = abs(it.x0 - prev.x0) <= 2 if item_x is None else abs(it.x0 - it.col_x0 - item_x) <= 2
            # An unfinished sentence continues whatever the indent (a line
            # starting with a pictogram, a column edge snapped differently).
            return aligned or not clean_text(prev.text).endswith(SENTENCE_END)
        return not doc.para_break(prev, it)
    # Column / page break: join when the sentence is clearly unfinished.
    prev_text = clean_text(prev.text)
    nxt = clean_text(it.text)
    unfinished = bool(nxt) and not prev_text.endswith(SENTENCE_END)
    if list_mode:
        return indented or (unfinished and nxt[:1].islower())
    if not unfinished:
        return False
    return nxt[:1].islower() or prev_text.endswith((",", "-")) or nxt[:1] == REF_MARK


def dash_is_punctuation(prev: Item | None) -> bool:
    """A dash at the start of a wrapped line is usually punctuation."""
    return prev is not None and not clean_text(prev.text).endswith(SENTENCE_END)


def strip_marker(it: Item) -> Item:
    """Copy of a list line without its bullet or step number."""
    spans = [s.copy() for s in it.spans]
    for s in spans:
        if not s.text.strip():
            continue
        m = BULLET_RE.match(s.text.lstrip()) or ORDERED_RE.match(s.text.lstrip())
        if m:
            s.text = s.text.lstrip()[m.end() :]
        elif s.text.strip() in "■●•▪◆○◦–—-" or re.fullmatch(r"\d{1,2}[.)]", s.text.strip()):
            s.text = ""
        break
    return it.with_spans(spans)


def list_marker(it: Item, glyph: str) -> dict[str, str]:
    """Preserve a PDF list marker as text and retain its source colour."""
    offset = len(it.text) - len(it.text.lstrip())
    position = 0
    for span in it.spans:
        end = position + len(span.text)
        if position <= offset < end:
            marker: dict[str, str] = {"glyph": glyph}
            if span.color is not None:
                marker["color"] = f"#{span.color:06x}"
            return marker
        position = end
    return {"glyph": glyph}


def strip_label(it: Item, label: str) -> Item:
    """Copy of a legend line without its mark ("A", "12")."""
    spans = [s.copy() for s in it.spans]
    for s in spans:
        if not s.text.strip():
            continue
        if s.text.lstrip().startswith(label):
            s.text = s.text.lstrip()[len(label) :].lstrip()
        break
    return it.with_spans(spans)


def split_at_pictogram(prev: Item, it: Item) -> bool:
    """Two pieces of one printed line cut by the wide gap of a pictogram
    ("Nacisnąć przycisk ⟨symbol⟩ jednokrotnie.")."""
    first = next((s for s in it.spans if s.text.strip()), None)
    last = next((s for s in reversed(prev.spans) if s.text.strip()), None)
    return bool((first and first.icon) or (last and last.icon)) and it.x0 - prev.x1 < max(prev.size, it.size) * 4
