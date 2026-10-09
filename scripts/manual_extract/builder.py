"""Section builder: turns the items of one section into content blocks
(headings, paragraphs, lists, definition lists, warnings, tables, images)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .document import Document
from .flow import belongs_to_warning, continues, dash_is_punctuation, strip_marker
from .frames import warning_label_of
from .geometry import center, contains
from .headings import is_heading
from .images import render_icon, render_image
from .legends import numbered_tables
from .model import Item
from .runs import join_runs, lines_to_runs, without_bold
from .text import BULLET_RE, DEFINITION_RE, ORDERED_RE, clean_text


class SectionBuilder:
    """Turns a slice of items into content blocks for one section page."""

    def __init__(self, doc: Document, section: dict[str, Any], assets_dir: Path | None, assets_url: str) -> None:
        self.doc = doc
        self.section = section
        self.assets_dir = assets_dir
        self.assets_url = assets_url
        self.blocks: list[dict[str, Any]] = []
        self.counter = 0
        self.para: list[Item] = []
        self.list: dict[str, Any] | None = None
        self.warning: dict[str, Any] | None = None
        self.last_line: Item | None = None
        self.last_heading: Item | None = None

    def next_id(self) -> str:
        self.counter += 1
        return f"b{self.counter}"

    def page_of(self, it: Item) -> int:
        return self.doc.printed.get(it.page, it.page + 1)

    # ----------------------------------------------------------------- feed

    def heading(self, text_items: list[Item], level: int) -> None:
        self.flush_all()
        runs = without_bold(self._runs(text_items))
        if runs:
            self.blocks.append({"type": "heading", "id": self.next_id(), "level": max(2, min(level, 4)), "runs": runs, "page": self.page_of(text_items[0])})
            self.last_heading = text_items[-1]

    def _continues_heading(self, it: Item) -> bool:
        """Second line of a heading that wraps inside its column."""
        prev = self.last_heading
        if prev is None or not self.blocks or self.blocks[-1]["type"] != "heading" or self.last_line is not prev:
            return False
        return (
            it.page == prev.page
            and it.col == prev.col
            and abs(it.size - prev.size) < 0.3
            and it.bold == prev.bold
            and not it.data.get("para_before", True)
        )

    def feed(self, it: Item) -> None:
        if it.kind == "table":
            self.flush_all()
            self.blocks.append({"type": "table", "id": self.next_id(), "header": bool(it.data.get("header", True)), "rows": it.data["rows"], "page": self.page_of(it)})
            return
        if it.kind == "image":
            rect = self._warning_frame_rect()
            is_icon = max(it.bbox[2] - it.bbox[0], it.bbox[3] - it.bbox[1]) < self.doc.args.icon_size
            if rect is not None and is_icon and it.page == self.warning["page_index"] and contains(rect, center(it.bbox)):  # type: ignore[index]
                return  # decorative pictogram inside a warning box
            self.flush_all()
            block = render_image(self.doc, self.assets_dir, self.assets_url, self.section, it, is_icon, self.page_of(it))
            if block:
                self.blocks.append({"type": "image", "id": self.next_id(), **block})
            return
        self._line(it)

    def _line(self, it: Item) -> None:
        text = clean_text(it.text)
        label = warning_label_of(it)
        if label and self.warning is not None and self.warning["frame"] is not None and it.data.get("frame") == self.warning["frame"]:
            label = None  # the word inside the text of its own box
        if label:
            kind, title, rest = label
            self.flush_all()
            self.warning = {
                "kind": kind,
                "title": title,
                "blocks": [],
                "page": self.page_of(it),
                "page_index": it.page,
                "frame": it.data.get("frame"),
                "indent": it.x0 - it.col_x0,
                "anchor": it,
                "lines": 0,
            }
            self.last_line = it
            if rest:
                self._line(Item("line", it.page, it.bbox, it.col, it.band, rest, dict(it.data), it.base))
            return
        if self.warning is not None and not belongs_to_warning(self.doc, self.warning, self.last_line or self.warning["anchor"], it):
            self.close_warning()
        if self.warning is None:
            if self._continues_heading(it):
                prev = self.blocks[-1]
                prev["runs"] = join_runs(prev["runs"], without_bold(self._runs([it])))
                self.last_heading = it
                self.last_line = it
                return
            level = is_heading(self.doc, it)
            if level is not None:
                self.heading([it], level)
                self.last_line = it
                return
        if self.warning is not None:
            self.warning["lines"] += 1
        definitions = self.list is not None and self.list.get("definitions")
        if it.data.get("defitem") or (DEFINITION_RE.match(text) and (it.data.get("para_before", True) or definitions)):
            self.flush_para()
            if self.list is None or not self.list.get("definitions"):
                self.flush_list()
                # Wrapped descriptions are indented, terms start at the column edge.
                self.list = {"ordered": False, "items": [], "page": self.page_of(it), "x": 6.0, "definitions": True}
            self.list["items"].append([it])
            self.last_line = it
            return
        bullet = BULLET_RE.match(text)
        ordered = ORDERED_RE.match(text)
        if bullet and bullet.group(1) in "\u2013\u2014-" and self.list is None and dash_is_punctuation(self.last_line):
            bullet = None
        if ordered and (
            # "2. bieg. Bieg ten…" continuing a sentence, not a step.
            (not it.data.get("para_before", True) and self.list is None and dash_is_punctuation(self.last_line))
            # "1) Zastrzeżony znak…": a footnote in smaller print.
            or it.size < self.doc.body_size * 0.95
        ):
            ordered = None
        if bullet or ordered:
            self.flush_para()
            is_ordered = bool(ordered and not bullet)
            if self.list is None or self.list["ordered"] != is_ordered:
                self.flush_list()
                self.list = {"ordered": is_ordered, "items": [], "page": self.page_of(it), "x": it.x0 - it.col_x0}
            self.list["items"].append([strip_marker(it)])
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

    def _continues(self, it: Item, list_mode: bool) -> bool:
        list_x = self.list["x"] if self.list is not None else None
        return continues(self.doc, self.last_line, it, list_x, self.warning is not None, list_mode)

    def _warning_frame_rect(self) -> tuple[float, float, float, float] | None:
        if self.warning is None or self.warning.get("frame") is None:
            return None
        pno, k = self.warning["frame"]
        r = self.doc.frames[pno][k]
        return (r.x0, r.y0, r.x1, r.y1)

    def _runs(self, lines: list[Item]) -> list[Any]:
        return lines_to_runs(lines, lambda ln, s: render_icon(self.doc, self.assets_dir, self.assets_url, ln.page, s))

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
        return numbered_tables(self.blocks)
