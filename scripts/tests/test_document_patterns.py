"""Regressions for document-specific layout and content preservation."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manual_extract import cli, layout, outline, reading, tables, text  # noqa: E402
from manual_extract.build import build  # noqa: E402
from manual_extract.document import Document  # noqa: E402
from manual_extract.model import Item, Span  # noqa: E402
from manual_extract.pdf import pymupdf  # noqa: E402
from manual_extract.runs import runs_to_text  # noqa: E402


def arguments(pdf: Path, root: Path):
    return cli.parse_args([
        "--book", "manual", "--pdf", str(pdf), "--title", "Parameters",
        "--out", str(root / "content"), "--assets", str(root / "assets"),
        "--assets-url", "/assets/manual", "--no-images",
    ])


def line(value: str, x: float, y: float, width: float = 100, page: int = 0, size: float = 9) -> Item:
    return Item("line", page, (x, y - size, x + width, y + 2), spans=[Span(value, False, False, size, "regular")], base=y)


class DocumentPatternTests(unittest.TestCase):
    def document(self, pages: int = 1) -> Document:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        pdf = pymupdf.open()
        for _ in range(pages):
            pdf.new_page(width=600, height=400)
        path = root / "sample.pdf"
        pdf.save(path)
        pdf.close()
        doc = Document(arguments(path, root))
        self.addCleanup(doc.pdf.close)
        return doc

    def test_marker_merge_preserves_character_coordinates(self) -> None:
        marker = line("1", 30, 50, width=4)
        marker.data["char_x"] = [30.0]
        value = line("CHECK VALUE", 42, 50, width=60)
        value.data["char_x"] = [42.0 + i * 3 for i in range(len(value.text))]
        value.data["char_x"][6:] = [x + 4 for x in value.data["char_x"][6:]]
        merged = reading.merge_markers([marker, value])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].text, "1 CHECK VALUE")
        self.assertEqual(len(merged[0].data["char_x"]), len(merged[0].text))
        self.assertEqual([it.text.strip() for it in tables.split_at(merged[0], [63])], ["1 CHECK", "VALUE"])

    def test_cell_gaps_scale_with_measured_word_spaces(self) -> None:
        for space in (1.0, 9.0):
            with self.subTest(space=space):
                item = line("ONE TWO THREE", 30, 50, width=space * 22, size=space * 3.6)
                xs = [30.0 + i * space for i in range(len(item.text))]
                cut = item.text.index("THREE")
                xs[cut:] = [x + space for x in xs[cut:]]
                item.data = {"char_x": xs, "space_width": space}
                self.assertEqual(len(tables.split_at(item, [xs[4]])), 1)
                self.assertEqual([it.text.strip() for it in tables.split_at(item, [xs[cut]])], ["ONE TWO", "THREE"])

    def test_word_spaces_are_learned_separately_by_font_size(self) -> None:
        doc = self.document()
        for size, space in ((4.0, 1.0), (30.0, 9.0)):
            item = line("ONE TWO THREE", 30, 50, size=size)
            item.data["char_x"] = [30.0 + i * space for i in range(len(item.text))]
            doc.items.append(item)
        reading.measure_word_spaces(doc)
        self.assertEqual([it.data["space_width"] for it in doc.items], [1.0, 9.0])

    def test_isolated_legend_marker_uses_recurring_column(self) -> None:
        doc = self.document(pages=4)
        for page in range(3):
            for x in (30, 210, 390):
                doc.items.append(line(f"Column {x}", x, 50, width=150, page=page))
        doc.items.extend([
            line("Left", 30, 50, width=150, page=3),
            line("3", 210, 50, width=5, page=3),
            line("Increase", 230, 70, width=130, page=3),
            line("4", 210, 90, width=5, page=3),
            line("Decrease", 230, 110, width=130, page=3),
            line("Right", 390, 50, width=150, page=3),
        ])
        layout.assign_layout(doc)
        last = [it for it in doc.items if it.page == 3]
        self.assertEqual([it.text for it in last], ["Left", "3", "Increase", "4", "Decrease", "Right"])
        self.assertEqual([it.col for it in last], [0, 1, 1, 1, 1, 2])
        self.assertEqual(last[2].col_x0, 210)

    def test_four_recurring_columns_are_not_forced_into_three(self) -> None:
        doc = self.document(pages=4)
        for page in range(4):
            for x in (30, 165, 300, 435):
                doc.items.append(line(f"Column {x}", x, 50, width=100, page=page))
        layout.assign_layout(doc)
        self.assertEqual([it.col for it in doc.items if it.page == 3], [0, 1, 2, 3])

    def test_outline_title_can_wrap_over_more_than_five_lines(self) -> None:
        doc = self.document()
        parts = ["Alpha/Beta", "gamma", "delta", "epsilon", "zeta", "eta"]
        doc.items = [line(part, 30, 50 + i * 12) for i, part in enumerate(parts)]
        self.assertEqual(outline.title_at(doc, 0, text.normalize_title(" ".join(parts))), 6)
        self.assertEqual(text.normalize_title("left/ right"), text.normalize_title("left/right"))

    def test_outline_title_does_not_cross_a_full_width_band(self) -> None:
        doc = self.document()
        doc.items = [line("First", 30, 50), line("Second", 30, 80)]
        doc.items[1].band = 1
        self.assertEqual(outline.title_at(doc, 0, "first second"), 0)


class OpenTableExtractionTests(unittest.TestCase):
    def extract(self, scale: float, unprinted: bool = False, single_group: bool = False, single_rule: bool = False, label_bookmark: bool = False) -> list[dict]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pdf = pymupdf.open()
            page = pdf.new_page(width=600 * scale, height=400 * scale)

            def put(x: float, y: float, value: str, size: float = 9, bold: bool = False) -> None:
                page.insert_text((x * scale, y * scale), value, fontsize=size * scale, fontname="hebo" if bold else "helv")

            def rule(y: float) -> None:
                for a, b in zip((35, 235, 360), (235, 360, 555)):
                    page.draw_line((a * scale, y * scale), (b * scale, y * scale), width=0.5 * scale)

            put(35, 40, "Parameters", 16, True)
            put(35, 67, "Fluids", 12, True)
            put(35, 92, "Fluid properties", bold=True)
            put(235, 110, "Both variants" if single_group else "Type one", bold=True)
            if not single_group:
                put(360, 110, "Type two", bold=True)
            rule(113)
            for x, value in zip((35, 235, 360), ("Material", "Steel", "Aluminium") if single_rule else ("Capacity", "3", "5")):
                put(x, 126, value)
            if not single_rule:
                rule(129)
            for x, value in zip((35, 235, 360), ("Finish", "Silver", "Graphite")):
                put(x, 142, value)
            put(35, 184, "1) Values supplied by the manufacturer.", 7)
            put(35, 213, "Additional information", bold=True)
            put(35, 228, "Keep the original wording.")
            toc = [[1, "Parameters", 1], [2, "Fluids", 1], [3, "Fluid properties", 1]]
            if unprinted:
                toc.append([3, "Unprinted bookmark", 1])
            toc.append([3, "Additional information", 1])
            if label_bookmark:
                toc.append([3, "Finish", 1])
            pdf.set_toc(toc)
            path = root / "sample.pdf"
            pdf.save(path)
            pdf.close()
            build(arguments(path, root))
            return json.loads((root / "content" / "parameters.json").read_text())["sections"]["parameters/fluids"]

    def test_open_bottom_row_and_outline_caption_at_different_scales(self) -> None:
        for scale in (1.0, 1.6):
            with self.subTest(scale=scale):
                blocks = self.extract(scale)
                found = [b for b in blocks if b["type"] == "table"]
                self.assertEqual(len(found), 1)
                self.assertEqual(found[0]["rows"], [["", "Type one", "Type two"], ["Capacity", "3", "5"], ["Finish", "Silver", "Graphite"]])
                headings = [runs_to_text(b["runs"]) for b in blocks if b["type"] == "heading"]
                self.assertEqual(headings, ["Fluid properties", "Additional information"])
                prose = [runs_to_text(b["runs"]) for b in blocks if b["type"] == "paragraph"]
                self.assertEqual(prose, ["1) Values supplied by the manufacturer.", "Keep the original wording."])

    def test_unprinted_bookmark_is_not_invented_as_body_content(self) -> None:
        blocks = self.extract(1.0, unprinted=True)
        self.assertFalse(any("Unprinted bookmark" in runs_to_text(b.get("runs", [])) for b in blocks))
        self.assertEqual(sum(b["type"] == "table" for b in blocks), 1)

    def test_group_header_with_empty_first_cell_is_kept(self) -> None:
        table = next(b for b in self.extract(1.0, single_group=True) if b["type"] == "table")
        self.assertEqual(table["rows"][0], ["", "Both variants", ""])
        self.assertTrue(table["header"])

    def test_one_rule_table_with_textual_values(self) -> None:
        table = next(b for b in self.extract(1.0, single_rule=True) if b["type"] == "table")
        self.assertEqual(table["rows"], [["", "Type one", "Type two"], ["Material", "Steel", "Aluminium"], ["Finish", "Silver", "Graphite"]])
        self.assertTrue(table["header"])

    def test_regular_table_label_can_match_an_unrelated_bookmark(self) -> None:
        table = next(b for b in self.extract(1.0, label_bookmark=True) if b["type"] == "table")
        self.assertEqual(table["rows"][-1], ["Finish", "Silver", "Graphite"])


if __name__ == "__main__":
    unittest.main()
