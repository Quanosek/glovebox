"""Tests for the extractor (scripts/extract.py, package manual_extract). Run: pnpm test:extract

Uses a synthetic PDF built by make_sample_pdf.py (the real manuals are
copyrighted and never committed).
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import make_sample_pdf  # noqa: E402

from manual_extract import cli, legends, outline, reading, runs, tables, text  # noqa: E402
from manual_extract.build import build  # noqa: E402
from manual_extract.model import Item, Span  # noqa: E402
from manual_extract.pdf import pymupdf  # noqa: E402


class SampleFontTests(unittest.TestCase):
    def test_supported_font_pairs(self) -> None:
        for regular, bold in make_sample_pdf.FONT_PAIRS:
            with self.subTest(regular=regular), tempfile.TemporaryDirectory() as directory:
                regular_path = Path(directory) / regular
                bold_path = Path(directory) / bold
                regular_path.touch()
                bold_path.touch()
                with patch.object(make_sample_pdf, "FONT_DIRS", [directory]):
                    self.assertEqual(make_sample_pdf._fonts(), (str(regular_path), str(bold_path)))

    def test_incomplete_pair_falls_back_to_complete_family(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "DejaVuSans.ttf").touch()
            regular = Path(directory) / "Georgia.ttf"
            bold = Path(directory) / "Georgia Bold.ttf"
            regular.touch()
            bold.touch()
            with patch.object(make_sample_pdf, "FONT_DIRS", [directory]):
                self.assertEqual(make_sample_pdf._fonts(), (str(regular), str(bold)))

    def test_missing_fonts_report_searched_directories(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(make_sample_pdf, "FONT_DIRS", [directory]), self.assertRaises(RuntimeError) as error:
                make_sample_pdf._fonts()
            self.assertIn("DejaVu Sans", str(error.exception))
            self.assertIn(directory, str(error.exception))


class HelperTests(unittest.TestCase):
    def test_slugify_polish(self) -> None:
        self.assertEqual(text.slugify("Kluczyki, drzwi i szyby"), "kluczyki-drzwi-i-szyby")
        self.assertEqual(text.slugify("Światła drogowe – Żółte"), "swiatla-drogowe-zolte")

    def test_dehyphenation(self) -> None:
        self.assertEqual(text.join_line_texts("zamy-", "kanie"), ("zamy", ""))
        self.assertEqual(text.join_line_texts("Start-", "Stop"), ("Start-", ""))
        self.assertEqual(text.join_line_texts("koniec", "zdania"), ("koniec", " "))

    def test_page_references(self) -> None:
        chars = [(c, False, False) for c in f"patrz {text.REF_MARK} 45, 46."]
        self.assertEqual(runs.build_runs(chars), ["patrz ", {"page": 45}, ", ", {"page": 46}, "."])

    def test_bold_runs(self) -> None:
        chars = [(c, False, False) for c in "Nacisnąć "] + [("c", True, False)] + [(".", False, False)]
        self.assertEqual(runs.build_runs(chars), ["Nacisnąć ", {"t": "c", "b": True}, "."])

    def test_definition_lines(self) -> None:
        self.assertTrue(text.DEFINITION_RE.match("W górę : podnoszenie siedziska"))
        self.assertTrue(text.DEFINITION_RE.match("INT = praca przerywana"))
        self.assertFalse(text.DEFINITION_RE.match("Obsługa przełącznika 1: regulacja"))

    def test_leaders_with_ellipsis_or_one_dot(self) -> None:
        self.assertTrue(text.LEADER_RE.search("wyświetlanie listy połączeń … 70"))
        self.assertTrue(text.LEADER_RE.search("wyświetlanie listy połączeń . 224"))
        self.assertFalse(text.LEADER_RE.search("Patrz str. 224"))
        self.assertFalse(text.LEADER_RE.search("zakres 1…6"))

    def test_scripts_become_unicode(self) -> None:
        spans = [
            Span("CO", False, False, 9.0, "f", (0, 0, 12, 10)),
            Span("2", False, False, 6.0, "f", (12, 4, 15, 11.5)),
            Span(" i cm", False, False, 9.0, "f", (15, 0, 35, 10)),
            Span("3", False, False, 6.0, "f", (35, -2, 38, 6)),
        ]
        reading.mark_scripts(spans, base=9.0)
        self.assertEqual("".join(s.text for s in spans), "CO₂ i cm³")
        self.assertEqual(text.normalize_title("Emisja CO₂"), "emisja co2")

    def test_line_split_at_column_boundary(self) -> None:
        line = "Silniki benzynowe Silniki wysokoprężne"
        xs = [341.0 + i * 2.5 for i in range(len(line))]  # a word space is 2.5 pt
        cut = line.index("Silniki", 1)
        xs[cut:] = [x + 2.0 for x in xs[cut:]]  # cells are 4.5 pt apart
        item = Item("line", 0, (xs[0], 0, xs[-1] + 4, 10), spans=[Span(line, False, False, 9.0, "f", None)], data={"char_x": xs})
        pieces = tables.split_at(item, [xs[cut] - 0.5])
        self.assertEqual([p.text for p in pieces], ["Silniki benzynowe ", "Silniki wysokoprężne"])
        # A word space at the boundary is not a cell gap.
        self.assertEqual(len(tables.split_at(item, [xs[8] - 0.5])), 1)

    def test_numbered_table_with_repeated_header(self) -> None:
        def para(bid: str, t: str) -> dict:
            return {"type": "paragraph", "id": bid, "runs": [t], "page": 230}

        blocks = [
            {"type": "heading", "id": "b1", "level": 4, "runs": ["Nr Obwód"], "page": 230},
            para("b2", "1 Moduł sterujący silnika"),
            para("b3", "2 Sonda lambda"),
            {"type": "heading", "id": "b4", "level": 4, "runs": ["Nr Obwód"], "page": 230},
            para("b5", "3 Rozrusznik"),
            para("b6", "Dalszy tekst."),
        ]
        out = legends.numbered_tables(blocks)
        self.assertEqual([b["type"] for b in out], ["table", "paragraph"])
        self.assertEqual(out[0]["rows"], [["Nr", "Obwód"], ["1", "Moduł sterujący silnika"], ["2", "Sonda lambda"], ["3", "Rozrusznik"]])


class SampleExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        tmp = Path(cls.tmp.name)
        pdf = tmp / "sample.pdf"
        make_sample_pdf.build(str(pdf))
        args = cli.parse_args(
            [
                "--book", "manual",
                "--pdf", str(pdf),
                "--out", str(tmp / "content"),
                "--assets", str(tmp / "assets"),
                "--assets-url", "/assets/manual",
                "--title", "Instrukcja obsługi",
            ]
        )
        cls.index = build(args)
        cls.chapter = json.loads((tmp / "content" / "kluczyki-drzwi-i-szyby.json").read_text("utf-8"))
        cls.assets = tmp / "assets"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.tmp.cleanup()

    def blocks(self, sid: str) -> list[dict]:
        return self.chapter["sections"][sid]

    def test_outline(self) -> None:
        ids = [s["id"] for s in self.index["sections"]]
        self.assertEqual(
            ids,
            [
                "kluczyki-drzwi-i-szyby",
                "kluczyki-drzwi-i-szyby/kluczyki-zamki",
                "kluczyki-drzwi-i-szyby/dach",
                "dane-techniczne",
            ],
        )  # "Skorowidz" is skipped; "Dane silnika", the only sub-category of an empty chapter, is merged
        self.assertEqual(self.index["sections"][1]["page"], 4)  # printed page number

    def test_paragraph_dehyphenated_without_running_header(self) -> None:
        texts = [runs.runs_to_text(b["runs"]) for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki") if b["type"] == "paragraph"]
        self.assertIn("Kluczyka nie należy przypinać do innych przedmiotów. Zapasowy kluczyk przechowywać w bezpiecznym miejscu.", texts)
        self.assertIn("System Start-Stop nie jest dostępny str. 45.", texts)

    def test_deep_outline_entry_is_heading(self) -> None:
        first = self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki")[0]
        self.assertEqual(first["type"], "heading")
        self.assertEqual(first["runs"], ["Kluczyki"])

    def test_lists(self) -> None:
        lists = [b for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki") if b["type"] == "list"]
        self.assertEqual(len(lists), 1)
        self.assertFalse(lists[0]["ordered"])
        self.assertEqual(runs.runs_to_text(lists[0]["items"][1]), "Kluczyk złożyć do wnętrza obudowy.")
        ordered = [b for b in self.blocks("kluczyki-drzwi-i-szyby/dach") if b["type"] == "list"]
        self.assertTrue(ordered[0]["ordered"])

    def test_warnings(self) -> None:
        warnings = [b for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki") if b["type"] == "warning"]
        self.assertEqual([w["kind"] for w in warnings], ["warning", "note"])
        self.assertEqual(runs.runs_to_text(warnings[0]["blocks"][0]["runs"]), "Nie zostawiać dzieci w samochodzie bez opieki.")
        self.assertEqual(len(warnings[1]["blocks"]), 1)

    def test_images(self) -> None:
        images = [b for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki") if b["type"] == "image"]
        self.assertEqual(len(images), 1)
        self.assertTrue(images[0]["src"].endswith(".webp"))
        rel = images[0]["src"].removeprefix("/assets/manual/")
        self.assertTrue((self.assets / rel).exists())
        texts = " ".join(runs.runs_to_text(b.get("runs", [])) for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki"))
        self.assertNotIn(" 1 ", f" {texts} ")  # callout numbers stay in the image
        vector = [b for b in self.blocks("kluczyki-drzwi-i-szyby/dach") if b["type"] == "image"]
        self.assertEqual(len(vector), 1)

    def test_table(self) -> None:
        tmp = Path(self.tmp.name)
        data = json.loads((tmp / "content" / "dane-techniczne.json").read_text("utf-8"))
        blocks = data["sections"]["dane-techniczne"]
        self.assertEqual([runs.runs_to_text(b["runs"]) for b in blocks if b["type"] == "heading"], ["Dane silnika"])
        table = next(b for b in blocks if b["type"] == "table")
        self.assertEqual(table["rows"][1], ["B16SHT", "125", "170"])


class OutlineTests(unittest.TestCase):
    def test_broken_outline_copy_is_replaced_by_working_copy(self) -> None:
        toc = [
            [1, "Wprowadzenie", -1],
            [1, "Kluczyki", -1],
            [2, "Zamki", -1],
            [1, "instrukcja.pdf", -1],
            [2, "Wprowadzenie", 4],
            [2, "Kluczyki", 10],
            [3, "Zamki", 11],
        ]
        self.assertEqual(
            outline.clean_toc(toc),
            [[1, "Wprowadzenie", 4], [1, "Kluczyki", 10], [2, "Zamki", 11]],
        )

    def test_leader_lines(self) -> None:
        self.assertTrue(text.LEADER_RE.search("Szyby ........ 34"))
        self.assertTrue(text.LEADER_RE.search("Oświetlenie asekuracyjne . . 138"))
        self.assertFalse(text.LEADER_RE.search("Przyciski stacji radiowych 1...6"))


class ThreeColumnExtractionTests(unittest.TestCase):
    """Layout of many car manuals: three columns, fake bold, symbol fonts,
    warning boxes broken across columns, rule-only tables."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        tmp = Path(cls.tmp.name)
        pdf = tmp / "three.pdf"
        make_sample_pdf.build_three_columns(str(pdf))
        args = cli.parse_args(
            [
                "--book", "manual",
                "--pdf", str(pdf),
                "--out", str(tmp / "content"),
                "--assets", str(tmp / "assets"),
                "--assets-url", "/assets/manual",
                "--title", "Instrukcja obsługi",
            ]
        )
        cls.index = build(args)
        chapter = json.loads((tmp / "content" / "kluczyki-drzwi-i-szyby.json").read_text("utf-8"))
        # Chapters whose only sub-category has no deeper entries are one page.
        cls.blocks = chapter["sections"]["kluczyki-drzwi-i-szyby"]
        cls.tech = json.loads((tmp / "content" / "dane-techniczne.json").read_text("utf-8"))
        cls.assets = tmp / "assets"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.tmp.cleanup()

    def texts(self, kind: str = "paragraph") -> list[str]:
        return [runs.runs_to_text(b["runs"]) for b in self.blocks if b["type"] == kind]

    def test_fixture_text_stays_inside_columns(self) -> None:
        with pymupdf.open(Path(self.tmp.name) / "three.pdf") as pdf:
            for block in pdf[0].get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    x0, y0, x1, _ = line["bbox"]
                    if y0 < 29:
                        continue
                    column = max(x for x in make_sample_pdf.COLS3 if x <= x0 + 1)
                    value = "".join(span["text"] for span in line["spans"])
                    with self.subTest(text=value):
                        self.assertLessEqual(x1, column + make_sample_pdf.COL3_W)

    def test_sentence_continues_in_next_column(self) -> None:
        self.assertIn(
            "Szyby otwierane elektrycznie działają po włączeniu zapłonu. Mechanizm zabezpieczający zatrzymuje szybę, gdy napotka opór. Po zwolnieniu przełącznika szyba zatrzymuje się w aktualnym położeniu.",
            self.texts(),
        )

    def test_running_header_removed(self) -> None:
        self.assertFalse(any("Kluczyki, drzwi i szyby" in t for t in self.texts()))

    def test_stroked_text_is_bold(self) -> None:
        para = next(b for b in self.blocks if b["type"] == "paragraph" and runs.runs_to_text(b["runs"]).startswith("Wybrać"))
        self.assertEqual(para["runs"], ["Wybrać ", {"t": "Ustawienia", "b": True}, " w menu."])
        self.assertIn("Wymiana", self.texts("heading"))

    def test_symbol_font_reference_and_pictogram(self) -> None:
        refs = next(b for b in self.blocks if b["type"] == "paragraph" and runs.runs_to_text(b["runs"]).startswith("Szczegóły"))
        self.assertEqual(refs["runs"], ["Szczegóły ", {"page": 12}, "."])
        button = next(b for b in self.blocks if b["type"] == "paragraph" and runs.runs_to_text(b["runs"]).startswith("Nacisnąć"))
        icon = button["runs"][1]
        self.assertEqual(set(icon), {"icon", "w", "h"})
        self.assertTrue((self.assets / icon["icon"].removeprefix("/assets/manual/")).exists())

    def test_warning_box_continues_in_next_column(self) -> None:
        warnings = [b for b in self.blocks if b["type"] == "warning"]
        self.assertEqual([w["kind"] for w in warnings], ["caution", "note"])
        self.assertEqual(
            [runs.runs_to_text(b["runs"]) for b in warnings[0]["blocks"]],
            ["Nie przymocowywać ciężkich przedmiotów do kluczyka, ponieważ mogą uszkodzić stacyjkę."],
        )

    def test_indented_note_ends_at_column_edge(self) -> None:
        note = [b for b in self.blocks if b["type"] == "warning"][1]
        self.assertEqual([runs.runs_to_text(b["runs"]) for b in note["blocks"]], ["Baterię wymieniać tylko na baterię tego samego typu."])
        self.assertIn("Kolejny akapit.", self.texts())

    def test_bullets_touching_text(self) -> None:
        lists = [b for b in self.blocks if b["type"] == "list"]
        self.assertEqual([[runs.runs_to_text(i) for i in b["items"]] for b in lists], [["Pierwszy punkt", "Drugi punkt"]])

    def test_table_with_horizontal_rules_only(self) -> None:
        table = next(b for b in self.tech["sections"]["dane-techniczne"] if b["type"] == "table")
        self.assertTrue(table["header"])
        self.assertEqual(table["rows"], [["Silnik", "B14NEL", "A16XHT"], ["Olej [l]", "4,0", "5,5"], ["Płyn [l]", "6,1", "6,3"]])


if __name__ == "__main__":
    unittest.main()
