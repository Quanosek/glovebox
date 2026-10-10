"""Section builder: turns the items of one section into content blocks
(headings, paragraphs, lists, definition lists, warnings, tables, images)."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .document import Document
from .flow import belongs_to_warning, continues, dash_is_punctuation, list_marker, strip_label, strip_marker
from .frames import warning_label_of
from .geometry import center, contains
from .headings import is_heading, strong
from .images import cell_graphic, render_icon, render_image, render_region
from .legends import numbered_tables
from .model import Box, Item
from .reading import circled
from .runs import join_runs, lines_to_runs, runs_to_text, without_bold
from .text import BULLET_RE, CAPTION_RE, DASHES, DEFINITION_RE, FOOTNOTE_RE, ORDERED_RE, SENTENCE_END, clean_text


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
        self.notes: list[list[Item]] = []

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
            self._table(it)
        elif it.kind == "image":
            self._image(it)
        else:
            self._line(it)

    def _table(self, it: Item) -> None:
        self.flush_all()
        header = it.data.get("header")
        if header is None:
            header = self._styled_first_row(it)
        block = {"type": "table", "id": self.next_id(), "header": bool(header), "rows": it.data["rows"], "page": self.page_of(it)}
        if header and it.data.get("header_rows"):
            block["headerRows"] = it.data["header_rows"]
        if it.data.get("spans"):
            block["spans"] = it.data["spans"]
        cells = self._table_cells(it)
        if cells is not None:
            block["cells"] = cells
        self.blocks.append(block)
        for box in it.data.get("notes", []):
            self._table_notes(it, box)

    def _image(self, it: Item) -> None:
        rect = self._warning_frame_rect()
        is_icon = max(it.bbox[2] - it.bbox[0], it.bbox[3] - it.bbox[1]) < self.doc.args.icon_size
        if rect is not None and is_icon and it.page == self.warning["page_index"] and contains(rect, center(it.bbox)):  # type: ignore[index]
            return  # decorative pictogram inside a warning box
        self.flush_all()
        block = render_image(self.doc, self.assets_dir, self.assets_url, self.section, it, is_icon, self.page_of(it))
        if block and it.data.get("caption_lines"):
            caption = self._runs(it.data["caption_lines"])
            if caption:
                block["caption"] = caption
                block["alt"] = runs_to_text(caption)
        if block:
            self.blocks.append({"type": "image", "id": self.next_id(), **block})

    def _line(self, it: Item) -> None:
        """A text line goes to the first step that takes it: footnote,
        warning label, heading, legend entry, definition, list item, list
        continuation, paragraph."""
        text = clean_text(it.text)
        if self._footnote(it, text) or self._warning_start(it):
            return
        if self.warning is not None and not belongs_to_warning(self.doc, self.warning, self.last_line or self.warning["anchor"], it):
            self.close_warning()
        if self.warning is None and self._heading_line(it):
            return
        if self.warning is not None:
            self.warning["lines"] += 1
        if self._legend_item(it) or self._definition_item(it, text) or self._list_item(it, text):
            self.last_line = it
            return
        if self.list is not None and self.list["items"] and self._continues(it, list_mode=True):
            self.list["items"][-1].append(it)
        else:
            self.flush_list()
            if self.para and not self._continues(it, list_mode=False):
                self.flush_para()
            self.para.append(it)
        self.last_line = it

    def _footnote(self, it: Item, text: str) -> bool:
        """Footnotes read aside (`footnotes()` in layout) wait for the end of
        the block they interrupted."""
        if not it.data.get("footnote"):
            return False
        if self.notes and not FOOTNOTE_RE.match(text):
            self.notes[-1].append(it)
        else:
            self.notes.append([it])
        return True

    def _warning_start(self, it: Item) -> bool:
        label = warning_label_of(it)
        if label and self.warning is not None and self.warning["frame"] is not None and it.data.get("frame") == self.warning["frame"]:
            label = None  # the word inside the text of its own box
        if not label:
            return False
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
            self._line(it.with_spans(rest))
        return True

    def _heading_line(self, it: Item) -> bool:
        if self._continues_heading(it):
            prev = self.blocks[-1]
            prev["runs"] = join_runs(prev["runs"], without_bold(self._runs([it])))
            self.last_heading = it
            self.last_line = it
            return True
        level = is_heading(self.doc, it)
        if level is None:
            return False
        self.heading([it], level)
        self.last_line = it
        return True

    def _legend_item(self, it: Item) -> bool:
        """A legend entry under an illustration ("Ⓐ Kontrola poziomu")."""
        legend = it.data.get("legend")
        if not legend:
            return False
        self.flush_para()
        if self.list is None or not self.list.get("legend"):
            self.flush_list()
            self.list = {"ordered": False, "items": [], "page": self.page_of(it), "x": it.x0 - it.col_x0, "markers": [], "legend": True}
        marker = {"glyph": circled(legend)}
        if it.data.get("legend_color"):
            marker["color"] = it.data["legend_color"]
        self.list["markers"].append(marker)
        self.list["item_x"] = it.x0 - it.col_x0
        self.list["items"].append([strip_label(it, legend)])
        return True

    def _bullet(self, it: Item, text: str) -> re.Match[str] | None:
        glyph = BULLET_RE.match(text)
        first = next((s for s in it.spans if s.text.strip()), None)
        if glyph and first is not None and first.icon:
            return None  # a pictogram drawn with a "-" glyph of a symbol font
        return glyph

    def _definition_item(self, it: Item, text: str) -> bool:
        """"Term : description" entries. A bullet glyph wins ("●Strefa A :
        Nie dolewać oleju." is a bullet item); a lower-case "term" continues
        a word broken at the line end ("przeciwmgiel- / nego : …") or a
        sentence when nothing follows its colon ("kontrolna :")."""
        definitions = bool(self.list is not None and self.list.get("definitions"))
        footnote = it.size < self.doc.body_size * 0.95 and FOOTNOTE_RE.match(text)
        glyph = self._bullet(it, text)
        prev_text = clean_text(self.last_line.text) if self.last_line is not None else ""
        bare = re.sub(r"[\s\ue000-\uf8ff]", "", re.split(r"[:=]", it.plain, maxsplit=1)[-1]) == ""
        continuation = (
            text[:1].islower()
            and not definitions
            and self.last_line is not self.last_heading
            and (prev_text.endswith(("-", "\u2010")) or (bare and dash_is_punctuation(self.last_line)))
        )
        term = DEFINITION_RE.match(text) and not footnote and not continuation
        defitem = it.data.get("defitem") and not continuation
        if not (defitem or (term and (it.data.get("para_before", True) or definitions))):
            return False
        if glyph and glyph.group(1) not in DASHES:
            return False
        self.flush_para()
        if not definitions:
            self.flush_list()
            # Wrapped descriptions are indented, terms start at the column edge.
            self.list = {"ordered": False, "items": [], "page": self.page_of(it), "x": 6.0, "definitions": True}
        self.list["items"].append([it])  # type: ignore[index]
        return True

    def _list_item(self, it: Item, text: str) -> bool:
        """Bulleted (with the original glyph and colour) or numbered items."""
        bullet = self._bullet(it, text)
        ordered = ORDERED_RE.match(text)
        if (
            bullet
            and bullet.group(1) in DASHES
            and self.list is None
            and dash_is_punctuation(self.last_line)
            # A dash that starts a new block is a list marker.
            and not it.data.get("para_before", True)
        ):
            bullet = None
        if ordered and (
            # "2. bieg. Bieg ten…" continuing a sentence, not a step.
            (not it.data.get("para_before", True) and self.list is None and dash_is_punctuation(self.last_line))
            # "1) Zastrzeżony znak…": a footnote in smaller print.
            or it.size < self.doc.body_size * 0.95
        ):
            ordered = None
        if not (bullet or ordered):
            return False
        self.flush_para()
        is_ordered = bool(ordered and not bullet)
        if self.list is None or self.list["ordered"] != is_ordered or self.list.get("definitions") or self.list.get("legend"):
            self.flush_list()
            self.list = {"ordered": is_ordered, "items": [], "page": self.page_of(it), "x": it.x0 - it.col_x0}
            if not is_ordered:
                self.list["markers"] = []
        if not is_ordered:
            self.list["markers"].append(list_marker(it, bullet.group(1)) if bullet else None)
        self.list["item_x"] = it.x0 - it.col_x0
        self.list["items"].append([strip_marker(it)])
        return True

    # -------------------------------------------------------------- helpers

    def _continues(self, it: Item, list_mode: bool) -> bool:
        list_x = self.list["x"] if self.list is not None else None
        item_x = self.list.get("item_x") if self.list is not None else None
        flush = self.doc.flush_bullets and self.list is not None and not self.list["ordered"] and not self.list.get("legend")
        return continues(self.doc, self.last_line, it, list_x, self.warning is not None, list_mode, item_x, flush)

    def _table_cells(self, table: Item) -> list[list[list[Any]]] | None:
        """Runs of every cell when some cell holds a pictogram, a page
        reference or a link (plain `rows` stay for search and data cards)."""
        boxes = table.data.get("cell_boxes")
        rows = table.data["rows"]
        if not boxes or len(boxes) != len(rows) or any(len(b) != len(r) for b, r in zip(boxes, rows)):
            return None
        per_cell = table.data.get("cell_lines")
        pool = table.data.get("lines", [])
        out: list[list[list[Any]]] = []
        rich = False
        for r, row in enumerate(boxes):
            out_row: list[list[Any]] = []
            for c, box in enumerate(row):
                lines = list(per_cell[r][c]) if per_cell else [ln for ln in pool if box and contains(box, center(ln.bbox))]
                graphic = cell_graphic(self.doc, table.page, box) if box else None
                if graphic is not None:
                    # Text drawn inside the pictogram (a circled number) is part of it.
                    lines = [ln for ln in lines if not contains(graphic, center(ln.bbox))]
                lines = [self._without_foreign_legend(ln, box) for ln in lines]
                runs = self._runs(sorted(lines, key=lambda ln: (round(ln.base), ln.x0))) if lines else []
                if graphic is not None:
                    icon = render_region(self.doc, self.assets_dir, self.assets_url, table.page, graphic, whiten=True)
                    if icon is not None:
                        runs = [icon] + ([" "] + runs if runs else [])
                rich = rich or any(isinstance(x, dict) and ("icon" in x or "page" in x or "href" in x) for x in runs)
                out_row.append(runs)
            out.append(out_row)
        return out if rich else None

    def _styled_first_row(self, table: Item) -> bool:
        """A gridded table has a header when its first row is set apart: bold
        or medium-weight text, or light text on a dark fill, unlike row two."""
        boxes = table.data.get("cell_boxes") or []
        pool = table.data.get("lines", [])

        def styled(row: list[Any]) -> bool | None:
            lines = [ln for ln in pool if any(b and contains(b, center(ln.bbox)) for b in row) and clean_text(ln.plain)]
            if not lines:
                return None
            return all(strong(ln) or light_text(ln) for ln in lines)

        if not boxes:
            return True
        rows = table.data.get("header_rows", 1)
        first = styled(boxes[0])
        second = styled(boxes[rows]) if len(boxes) > rows else None
        return bool(first) and not second

    def _table_notes(self, table: Item, box: Box) -> None:
        """Paragraphs of a notes row taken out of a table: a new note starts
        at the left edge after a finished sentence."""
        lines = sorted((ln for ln in table.data.get("lines", []) if contains(box, center(ln.bbox))), key=lambda ln: (round(ln.base), ln.x0))
        if not lines:
            return
        left = min(ln.x0 for ln in lines)
        group: list[Item] = []
        for ln in lines + [None]:  # type: ignore[list-item]
            if group and (ln is None or (abs(ln.x0 - left) < 2 and clean_text(group[-1].text).endswith(SENTENCE_END))):
                runs = self._runs(group)
                if runs:
                    self.blocks.append({"type": "paragraph", "id": self.next_id(), "runs": runs, "page": self.page_of(table)})
                group = []
            if ln is not None:
                group.append(ln)

    @staticmethod
    def _without_foreign_legend(ln: Item, box: Box | None) -> Item:
        """A legend mark merged with the text of the next cell stays in its own cell."""
        mark = ln.data.get("legend")
        circle = ln.data.get("legend_box")
        if mark and circle and box and not contains(box, center(circle)):
            return strip_label(ln, mark)
        return ln

    def _warning_frame_rect(self) -> Box | None:
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
            block = {"type": "list", "id": "", "ordered": self.list["ordered"], "items": items, "page": self.list["page"]}
            if self.list.get("markers"):
                block["markers"] = self.list["markers"][: len(items)]
            elif self.list.get("definitions"):
                # Definition lists have no marker in the manual: none is invented.
                block["markers"] = [None] * len(items)
            self._append(block)
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
        self.flush_notes()

    def flush_notes(self) -> None:
        """Footnotes read aside (`footnotes()` in layout) follow the block
        they interrupted."""
        notes, self.notes = self.notes, []
        for lines in notes:
            runs = self._runs(lines)
            if runs:
                self.blocks.append({"type": "paragraph", "id": self.next_id(), "runs": runs, "page": self.page_of(lines[0])})

    def finish(self) -> list[dict[str, Any]]:
        self.flush_all()
        return attach_captions(numbered_tables(self.blocks))


def light_text(ln: Item) -> bool:
    """White or very light text (a header printed on a dark fill)."""
    colors = [s.color for s in ln.spans if s.text.strip() and s.color is not None]
    return bool(colors) and all(sum((c >> k) & 255 for k in (16, 8, 0)) >= 3 * 210 for c in colors)



def attach_captions(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """A caption printed under an illustration ("Rys. 45 Kluczyki
    samochodowe") becomes the caption (and the description) of its image."""
    out: list[dict[str, Any]] = []
    for block in blocks:
        prev = out[-1] if out else None
        if (
            block["type"] == "paragraph"
            and prev is not None
            and prev["type"] == "image"
            and not prev.get("icon")
            and "caption" not in prev
            and CAPTION_RE.match(runs_to_text(block["runs"]))
        ):
            prev["caption"] = block["runs"]
            prev["alt"] = runs_to_text(block["runs"])
            continue
        out.append(block)
    return out
