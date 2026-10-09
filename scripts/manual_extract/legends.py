"""Numbered tables without rules: a header such as "Nr Obwód" followed by
numbered rows ("1 Moduł sterujący silnika"), often repeated at the top of
every column (fuse assignments)."""

from __future__ import annotations

import re
from typing import Any

from .runs import runs_to_text

HEADER_RE = re.compile(r"^(Nr\.?|No\.?|Poz\.?|Lp\.?)\s+(\S.{0,40})$", re.I)
ROW_RE = re.compile(r"^(\d{1,3})\s+(\S.*)$")


def _text(block: dict[str, Any]) -> str | None:
    """Plain text of a heading or paragraph without links or symbols."""
    if block["type"] not in ("heading", "paragraph"):
        return None
    if any(isinstance(r, dict) and ("page" in r or "icon" in r) for r in block["runs"]):
        return None
    return runs_to_text(block["runs"]).strip()


def numbered_tables(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Replace a "Nr …" header and the numbered rows after it (repeated
    headers included) by one table block; needs at least two rows."""
    out: list[dict[str, Any]] = []
    i = 0
    while i < len(blocks):
        block = blocks[i]
        text = _text(block)
        head = HEADER_RE.match(text) if text else None
        if not head:
            out.append(block)
            i += 1
            continue
        rows: list[list[str]] = []
        j = i + 1
        while j < len(blocks):
            nxt = _text(blocks[j])
            row = ROW_RE.match(nxt) if nxt and blocks[j]["type"] == "paragraph" else None
            if row:
                rows.append([row.group(1), row.group(2)])
            elif nxt != text:  # a repeated header at the top of the next column
                break
            j += 1
        if len(rows) < 2:
            out.append(block)
            i += 1
            continue
        out.append({"type": "table", "id": block["id"], "header": True, "rows": [[head.group(1), head.group(2)], *rows], "page": block.get("page")})
        i = j
    return out
