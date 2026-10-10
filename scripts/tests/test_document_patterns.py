"""Regressions for document-specific layout and content preservation."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manual_extract import cli, layout, outline, reading, tables, text  # noqa: E402
from manual_extract.build import build, inline_leaf_children, merge_lone_children  # noqa: E402
from manual_extract.builder import SectionBuilder, attach_captions  # noqa: E402
from manual_extract.document import Document  # noqa: E402
from manual_extract.figures import attach_figure_captions  # noqa: E402
from manual_extract.flow import list_marker, split_at_pictogram, strip_marker  # noqa: E402
from manual_extract.model import Item, Span  # noqa: E402
from manual_extract.pdf import pymupdf  # noqa: E402
from manual_extract.runs import build_runs, runs_to_text  # noqa: E402


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

    def test_fallback_outline_joins_hyphenated_wrapped_headings(self) -> None:
        doc = self.document()
        doc.body_size = 6.5
        doc.pitch = 8
        doc.items = [
            Item("line", 0, (30, 25, 130, 42), spans=[Span("Dane techniczne", True, False, 13, "bold")], base=40),
            Item("line", 0, (30, 50, 150, 64), spans=[Span("Informacje o danych tech-", True, False, 11, "bold")], base=61),
            Item("line", 0, (30, 64, 95, 78), spans=[Span("nicznych", True, False, 11, "bold")], base=75),
        ]

        entries = outline.outline_from_headings(doc)

        self.assertEqual(
            [(entry["level"], entry["title"]) for entry in entries],
            [(1, "Dane techniczne"), (2, "Informacje o danych technicznych")],
        )

    def test_colored_bullet_remains_a_text_marker(self) -> None:
        doc = self.document()
        marker = Span("● ", False, False, 9, "Symbols", color=0xF26729)
        text_span = Span("Instrukcja obsługi pojazdu", False, False, 9, "Body", color=0x231F20)
        bullet = Item("line", 0, (30, 40, 175, 52), spans=[marker, text_span], base=50)
        body = line("A representative body font sample", 30, 70)
        body.spans[0].font = "Body"

        reading.classify_symbol_fonts(doc, [bullet, body])

        self.assertFalse(marker.icon)
        self.assertEqual(list_marker(bullet, "●"), {"glyph": "●", "color": "#f26729"})
        self.assertEqual(strip_marker(bullet).spans[0].color, 0xF26729)

        builder = SectionBuilder(doc, {"title": "Przykład", "chapter_slug": "przyklad"}, None, "")
        builder.feed(bullet)
        block = builder.finish()[0]
        self.assertEqual(block["markers"], [{"glyph": "●", "color": "#f26729"}])
        self.assertEqual(runs_to_text(block["items"][0]), "Instrukcja obsługi pojazdu")

    def test_titles_ignore_direction_marks_asterisks_footnotes_and_quotes(self) -> None:
        self.assertEqual(text.clean_text("\u200eSpis treści\u200e"), "Spis treści")
        for printed, outlined in [
            ("Climatronic* sterowanie", "Climatronic sterowanie"),
            ("Nawigacja¹⁾", "Nawigacja"),
            ("„My Beat“ - funkcja", "My Beat - funkcja"),
            ("Światła awaryjne \uf03e", "Światła awaryjne"),
            ("Jak działa Climatronic?", "Jak działa Climatronic ?"),
            ("ostrzegawcze\ufeff/\ufeffkontrolne", "ostrzegawcze/kontrolne"),
        ]:
            with self.subTest(printed=printed):
                self.assertEqual(text.normalize_title(printed), text.normalize_title(outlined))

    def test_reference_arrows_with_words_become_page_references(self) -> None:

        def runs(value: str) -> list:
            return build_runs([(c, False, False) for c in value])

        arrows = text.REF_MARK * 3
        self.assertEqual(runs(f"{arrows} strona 296."), [{"page": 296}, "."])
        self.assertEqual(runs(f"{arrows} zob. Opis na stronie 137"), ["zob. Opis na ", {"page": 137}])
        self.assertEqual(runs(f"patrz {text.REF_MARK} 45, 46."), ["patrz ", {"page": 45}, ", ", {"page": 46}, "."])
        self.assertEqual(runs(f"{arrows} rys. 2 do"), ["rys. 2 do"])

    def test_continuation_mark_and_fallback_letters_are_text(self) -> None:
        doc = self.document()
        tail = Item("line", 0, (30, 40, 175, 52), spans=[Span("Przy ręcznym ", False, False, 9, "Body"), Span("»", False, False, 9, "Symbols")], base=50)
        self.assertEqual([ln.text for ln in reading.strip_continuation_marks([tail])], ["Przy ręcznym "])

        word = Item("line", 0, (30, 60, 175, 72), spans=[
            Span("Bie", False, False, 9, "Body"), Span("ż", True, False, 9, "Fallback-Bold"), Span("ące zu", False, False, 9, "Body"),
            Span("ż", True, False, 9, "Fallback-Bold"), Span("ycie paliwa", False, False, 9, "Body"),
        ], base=70)
        body = line("A representative body font sample", 30, 90)
        body.spans[0].font = "Body"
        reading.classify_symbol_fonts(doc, [word, body])
        self.assertFalse(any(s.icon or s.bold for s in word.spans))

    def test_wide_footnote_does_not_join_columns(self) -> None:
        items = [line(f"Text {k}", x, 40 + k * 10, width=120) for x in (30, 175, 320) for k in range(6)]
        items.append(line("1) Footnote under two columns", 30, 330, width=180))
        self.assertEqual(len(layout.find_columns(items, 480)), 3)

    def test_flush_bullet_items_keep_their_wrapped_lines(self) -> None:
        doc = self.document()
        doc.body_size, doc.pitch, doc.flush_bullets = 9, 11, True
        lines = [line("● Podczas jazdy z nowymi oponami", 30, 50), line("zachować ostrożność.", 30, 61), line("● Okresowo sprawdzać opony.", 30, 76)]
        for it in lines:
            it.data.update({"col_x0": 30, "para_before": False})
        builder = SectionBuilder(doc, {"title": "Opony", "chapter_slug": "opony"}, None, "")
        for it in lines:
            builder.feed(it)
        block = builder.finish()[0]
        self.assertEqual([runs_to_text(item) for item in block["items"]], ["Podczas jazdy z nowymi oponami zachować ostrożność.", "Okresowo sprawdzać opony."])

    def test_empty_category_with_one_sub_category_is_merged(self) -> None:

        entries = [
            {"level": 1, "title": "Dane techniczne"},
            {"level": 2, "title": "Informacje o danych technicznych"},
            {"level": 3, "title": "Silnik"},
            {"level": 1, "title": "Klimatyzacja"},
            {"level": 2, "title": "Ogrzewanie"},
        ]
        merge_lone_children(entries, [False, True, True, True, True], 2)
        self.assertTrue(entries[1].get("merged"))
        self.assertFalse(entries[1]["same_title"])
        self.assertEqual(entries[2]["level"], 3)
        # A category with text of its own keeps its sub-category as a page.
        self.assertFalse(entries[4].get("merged"))

    def test_category_with_leaf_sub_categories_is_one_page(self) -> None:

        entries = [
            {"level": 1, "title": "Ogólny wygląd pojazdu"},
            {"level": 2, "title": "Widok przedni"},
            {"level": 2, "title": "Widok tylny"},
            {"level": 1, "title": "Bezpieczeństwo"},
            {"level": 2, "title": "Pasy"},
            {"level": 3, "title": "Zapinanie"},
            {"level": 2, "title": "Poduszki"},
        ]
        inline_leaf_children(entries, 2)
        self.assertEqual([bool(e.get("inline")) for e in entries], [False, True, True, False, False, False, False])

    def test_internet_addresses_become_links(self) -> None:

        runs = build_runs([(c, False, False) for c in "Adres: www.seat.com/owners. Koniec"])
        self.assertEqual(runs, ["Adres: ", {"t": "www.seat.com/owners", "href": "https://www.seat.com/owners"}, ". Koniec"])
        self.assertEqual(text.join_line_texts("https://www.seat.com/owners/", "manuals.html"), ("https://www.seat.com/owners/", ""))

    def test_circled_legend_mark_joins_its_description(self) -> None:
        mark = line("B", 181, 261, width=3, size=5.2)
        description = line("Pokrywa silnika", 192, 262, width=50, size=6.5)
        merged = reading.merge_markers([mark, description], [(179.1, 255.8, 186.7, 263.4, (0.95, 0.4, 0.16))])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].data["legend"], "B")
        self.assertEqual(merged[0].text, "B Pokrywa silnika")
        self.assertEqual(merged[0].data["legend_color"], "#f26629")
        self.assertEqual([reading.circled(v) for v in ("1", "10", "21", "B", "99")], ["①", "⑩", "㉑", "Ⓑ", "99"])


class TableAndFigureTests(unittest.TestCase):
    def test_merged_cells_get_spans(self) -> None:
        boxes = [
            [(0, 0, 50, 30), (50, 0, 150, 15), None],
            [None, (50, 15, 100, 30), (100, 15, 150, 30)],
            [(0, 30, 50, 40), (50, 30, 100, 40), (100, 30, 150, 40)],
        ]
        self.assertEqual(tables.cell_spans(boxes), [[[1, 2], [2, 1], None], [None, [1, 1], [1, 1]], [[1, 1], [1, 1], [1, 1]]])
        self.assertIsNone(tables.cell_spans([[(0, 0, 10, 10), (10, 0, 20, 10)]]))

    def test_caption_under_illustration_joins_the_image(self) -> None:

        blocks = [
            {"type": "image", "id": "b1", "src": "a.webp", "alt": "Ilustracja"},
            {"type": "paragraph", "id": "b2", "runs": [{"t": "Rys. 45", "b": True}, " Kluczyki samochodowe"]},
            {"type": "paragraph", "id": "b3", "runs": ["Zwykły akapit."]},
        ]
        out = attach_captions(blocks)
        self.assertEqual([b["id"] for b in out], ["b1", "b3"])
        self.assertEqual(out[0]["alt"], "Rys. 45 Kluczyki samochodowe")


class CaptionAndListTests(unittest.TestCase):
    def test_caption_beside_an_illustration_belongs_to_it(self) -> None:

        figure = Item("image", 0, (40, 90, 420, 240))
        caption = line("Rys. 170 Regulacja ogrzewania na tablicy roz-", 430, 230, width=140, size=6.5)
        wrapped = line("dzielczej", 430, 238, width=30, size=6.5)
        text = line("Regulacja temperatury", 40, 260, width=90, size=6.5)
        kept = attach_figure_captions([figure], [caption, wrapped, text])
        self.assertEqual(kept, [text])
        self.assertEqual(figure.data["caption_lines"], [caption, wrapped])

    def test_line_cut_by_a_pictogram_stays_in_its_item(self) -> None:

        head = line("● Nacisnąć przycisk", 330, 317, width=60, size=6.5)
        tail = Item("line", 0, (397, 310, 437, 318), spans=[Span("\uf0d8", False, False, 6.5, "Sym", icon=True), Span(" jednokrotnie.", False, False, 6.5, "Body")], base=317.2)
        self.assertTrue(split_at_pictogram(head, tail))
        self.assertFalse(split_at_pictogram(head, line("AUTO : tryb", 397, 317, size=6.5)))


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
            return json.loads((root / "content" / "parameters.json").read_text())["sections"]["parameters"]

    def test_open_bottom_row_and_outline_caption_at_different_scales(self) -> None:
        for scale in (1.0, 1.6):
            with self.subTest(scale=scale):
                blocks = self.extract(scale)
                found = [b for b in blocks if b["type"] == "table"]
                self.assertEqual(len(found), 1)
                self.assertEqual(found[0]["rows"], [["", "Type one", "Type two"], ["Capacity", "3", "5"], ["Finish", "Silver", "Graphite"]])
                headings = [runs_to_text(b["runs"]) for b in blocks if b["type"] == "heading"]
                # "Parameters" has no text of its own and one sub-category: one page.
                self.assertEqual(headings, ["Fluids", "Fluid properties", "Additional information"])
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
