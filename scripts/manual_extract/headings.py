"""Headings that are not in the outline (font size / weight)."""

from __future__ import annotations

import re

from .document import Document
from .frames import warning_label_of
from .model import Item
from .text import BULLET_RE, ORDERED_RE, REF_MARK, clean_text


def is_heading(doc: Document, it: Item) -> int | None:
    text = clean_text(it.plain.replace(REF_MARK, ""))
    if not text or len(text) > 90 or text.endswith((",", ";")):
        return None
    if warning_label_of(it) is not None:
        return None
    if BULLET_RE.match(text) or ORDERED_RE.match(text) or REF_MARK in it.text:
        return None
    if re.match(r"^\d{1,2}\s", text) and it.size < doc.body_size * 1.3:
        return None  # numbered legend entry of an illustration ("1 RADIO")
    if not re.search(r"[A-Za-zÀ-ž]", text):
        return None
    alone = it.data.get("para_before", True) and it.data.get("para_after", True)
    size = it.size
    if size >= doc.body_size * 1.3 and it.data.get("para_before", True):
        return 2
    if it.bold and size >= doc.body_size * 1.08 and it.data.get("para_before", True):
        return 3
    # A bold line of body size is a heading only when it stands alone,
    # not when a bold phrase fills one line of a paragraph.
    if it.bold and alone and not text.endswith(".") and size >= doc.body_size * 0.98:
        return 4
    return None
