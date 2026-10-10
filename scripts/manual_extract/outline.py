"""Sections from the PDF outline: cleaning broken outlines and locating
every entry in the text."""

from __future__ import annotations

import re
import sys
from typing import Any

from .document import Document
from .text import REF_MARK, clean_text, join_line_texts, normalize_title


def outline(doc: Document) -> list[dict[str, Any]]:
    toc = clean_toc(doc.pdf.get_toc(simple=False))
    entries: list[dict[str, Any]] = []
    missing = 0
    for lvl, title, pno, dest in toc:
        title = clean_text(title)
        if not title or pno > doc.page_count:
            continue
        if pno < 1:
            # Broken destination: the entry is located by its title.
            missing += 1
            entries.append({"level": lvl, "title": title, "page": None, "y": None})
            continue
        to_y = None
        if isinstance(dest, dict) and dest.get("to") is not None:
            try:
                to_y = float(dest["to"].y)
            except Exception:
                to_y = None
        entries.append({"level": lvl, "title": title, "page": pno - 1, "y": to_y})
    if missing:
        print(f"  ! {missing} outline entries without a page, located by title", file=sys.stderr)
    if entries:
        return entries
    print("  ! PDF has no outline, falling back to font-size headings", file=sys.stderr)
    return outline_from_headings(doc)


def clean_toc(toc: list[list[Any]]) -> list[list[Any]]:
    """Some PDFs carry the outline twice: a copy whose destinations are
    broken and a working copy nested under a bookmark named after the file
    ("instrukcja_….pdf"). Keep the working copy at the top level."""
    trees: list[list[list[Any]]] = []
    for entry in toc:
        if entry[0] <= 1 or not trees:
            trees.append([])
        trees[-1].append(list(entry))
    broken = [t for t in trees if all(e[2] < 1 for e in t)]
    working = [t for t in trees if any(e[2] >= 1 for e in t)]
    if broken and working:
        good_titles = {normalize_title(e[1]) for t in working for e in t}
        bad_titles = [normalize_title(e[1]) for t in broken for e in t]
        if sum(1 for title in bad_titles if title in good_titles) >= len(bad_titles) * 0.6:
            trees = working
    out: list[list[Any]] = []
    for t in trees:
        head = t[0]
        if len(t) > 1 and head[0] == 1 and re.search(r"\.pdf$", str(head[1]).strip(), re.I):
            out.extend([[e[0] - 1, *e[1:]] for e in t[1:]])
        else:
            out.extend(t)
    return out


def outline_from_headings(doc: Document) -> list[dict[str, Any]]:
    sizes = sorted({it.size for it in doc.items if it.kind == "line" and it.size >= doc.body_size * 1.3}, reverse=True)
    level_of = {s: (1 if i == 0 else 2) for i, s in enumerate(sizes)}
    entries = []
    for idx, it in enumerate(doc.items):
        if it.kind == "line" and it.size in level_of and len(clean_text(it.text)) < 90:
            entry = {
                "level": level_of[it.size],
                "title": clean_text(it.text.replace(REF_MARK, "")),
                "page": it.page,
                "y": it.y0,
                "_index": idx,
                "_item": it,
            }
            if entries and continues_wrapped_heading(entries[-1], entry, doc):
                previous = entries[-1]
                fixed, separator = join_line_texts(previous["title"], entry["title"])
                previous["title"] = fixed + separator + entry["title"]
                previous["_index"] = entry["_index"]
                previous["_item"] = entry["_item"]
                continue
            entries.append(entry)
    for entry in entries:
        entry.pop("_index")
        entry.pop("_item")
    return entries


def continues_wrapped_heading(previous: dict[str, Any], current: dict[str, Any], doc: Document) -> bool:
    previous_item = previous["_item"]
    current_item = current["_item"]
    return (
        previous["level"] == current["level"]
        and previous_item.page == current_item.page
        and previous_item.col == current_item.col
        and previous_item.band == current_item.band
        and current["_index"] == previous["_index"] + 1
        and clean_text(previous_item.text).endswith(("-", "\u2010"))
        and current["title"][:1].islower()
        and current_item.base - previous_item.base <= max(previous_item.size, current_item.size) * 2
    )


def title_at(doc: Document, idx: int, target: str) -> int:
    """Number of lines starting at `idx` that spell `target`, or 0."""
    combined = ""
    for k in range(len(target) + 1):
        if idx + k >= len(doc.items) or doc.items[idx + k].kind != "line":
            break
        line = doc.items[idx + k]
        if k and not (line.page == doc.items[idx].page and line.col == doc.items[idx].col and line.band == doc.items[idx].band):
            break
        prev, sep = join_line_texts(combined, line.text) if combined else ("", "")
        combined = prev + sep + line.text
        if normalize_title(combined) == target:
            return k + 1
        if len(normalize_title(combined)) > len(target):
            break
    return 0


def locate_entries(doc: Document, entries: list[dict[str, Any]]) -> list[int]:
    """Find the item index where each outline entry starts (monotonic)."""
    positions: list[int] = []
    start = 0
    page_first: dict[int, int] = {}
    for idx, it in enumerate(doc.items):
        page_first.setdefault(it.page, idx)
    for e in entries:
        target = normalize_title(e["title"])
        found: int | None = None
        fallback: tuple[int, int] | None = None
        known = e["page"] is not None
        if known:
            first_page, last_page = e["page"] - 1, e["page"] + 1
        else:
            here = doc.items[start].page if start < len(doc.items) else doc.page_count
            first_page, last_page = here, here + 12
        idx = start
        while idx < len(doc.items) and doc.items[idx].page <= last_page:
            it = doc.items[idx]
            if it.kind == "line" and it.page >= first_page:
                span = title_at(doc, idx, target)
                if span:
                    # Prefer a line that starts a block over a phrase in running text.
                    if it.data.get("para_before", True):
                        found = idx
                        e["span"] = span
                        break
                    if fallback is None:
                        fallback = (idx, span)
            idx += 1
        if found is None and fallback is not None:
            found, e["span"] = fallback
        if found is None:
            e["span"] = 0
            print(f"  ! outline title not found in page text: {e['title']}; retaining text at its destination", file=sys.stderr)
            if known:
                # Fall back to the outline destination.
                candidates = [
                    i for i in range(start, len(doc.items))
                    if doc.items[i].page == e["page"] and (e["y"] is None or doc.items[i].y1 >= e["y"] - 2)
                ]
                found = candidates[0] if candidates else page_first.get(e["page"], start)
                found = max(found, start)
            else:
                found = start
        if e["page"] is None:
            e["page"] = doc.items[found].page if found < len(doc.items) else doc.page_count - 1
        positions.append(found)
        # The next entry starts after this title ("Narzędzia samochodowe"
        # followed by its sub-entry "Narzędzia").
        start = found + e["span"]
    return positions
