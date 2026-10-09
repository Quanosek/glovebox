"""Rules deciding whether a line continues the current warning, paragraph or
list item (across columns and pages too), and list marker removal."""

from __future__ import annotations

import re
from typing import Any

from .document import Document
from .headings import is_heading
from .model import Item, Span
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


def continues(doc: Document, prev: Item | None, it: Item, list_x: float | None, in_warning: bool, list_mode: bool) -> bool:
    """True when `it` continues the paragraph (or, with `list_mode`, the list
    item whose text starts `list_x` points from the column edge) of `prev`."""
    if prev is None:
        return False
    if not in_warning and it.data.get("frame") != prev.data.get("frame"):
        return False
    indented = list_x is not None and it.x0 - it.col_x0 > list_x + 2
    if it.page == prev.page and it.col == prev.col and it.band == prev.band:
        if list_mode:
            # Indented paragraphs below a bullet belong to the same item.
            return indented and it.base - prev.base < doc.pitch * 2.5
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
    spans = [Span(s.text, s.bold, s.italic, s.size, s.font, s.bbox, s.icon) for s in it.spans]
    for s in spans:
        if not s.text.strip():
            continue
        m = BULLET_RE.match(s.text.lstrip()) or ORDERED_RE.match(s.text.lstrip())
        if m:
            s.text = s.text.lstrip()[m.end() :]
        elif s.text.strip() in "■●•▪◆○◦–—-" or re.fullmatch(r"\d{1,2}[.)]", s.text.strip()):
            s.text = ""
        break
    return Item("line", it.page, it.bbox, it.col, it.band, spans, dict(it.data), it.base)
