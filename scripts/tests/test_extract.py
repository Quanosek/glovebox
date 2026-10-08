"""Tests for scripts/extract.py. Run: npm run test:extract

Uses a synthetic PDF built by make_sample_pdf.py (the real manuals are
copyrighted and never committed).
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import extract  # noqa: E402
import make_sample_pdf  # noqa: E402


class HelperTests(unittest.TestCase):
    def test_slugify_polish(self) -> None:
        self.assertEqual(extract.slugify("Kluczyki, drzwi i szyby"), "kluczyki-drzwi-i-szyby")
        self.assertEqual(extract.slugify("Światła drogowe – Żółte"), "swiatla-drogowe-zolte")

    def test_dehyphenation(self) -> None:
        self.assertEqual(extract.join_line_texts("zamy-", "kanie"), ("zamy", ""))
        self.assertEqual(extract.join_line_texts("Start-", "Stop"), ("Start-", ""))
        self.assertEqual(extract.join_line_texts("koniec", "zdania"), ("koniec", " "))

    def test_page_references(self) -> None:
        chars = [(c, False, False) for c in f"patrz {extract.REF_MARK} 45, 46."]
        runs = extract.build_runs(chars)
        self.assertEqual(runs, ["patrz ", {"page": 45}, ", ", {"page": 46}, "."])

    def test_bold_runs(self) -> None:
        chars = [(c, False, False) for c in "Nacisnąć "] + [("c", True, False)] + [(".", False, False)]
        self.assertEqual(extract.build_runs(chars), ["Nacisnąć ", {"t": "c", "b": True}, "."])


class SampleExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        tmp = Path(cls.tmp.name)
        pdf = tmp / "sample.pdf"
        make_sample_pdf.build(str(pdf))
        args = extract.parse_args(
            [
                "--book", "manual",
                "--pdf", str(pdf),
                "--out", str(tmp / "content"),
                "--assets", str(tmp / "assets"),
                "--assets-url", "/assets/manual",
                "--title", "Instrukcja obsługi",
            ]
        )
        cls.index = extract.build(args)
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
                "dane-techniczne/dane-silnika",
            ],
        )  # "Skorowidz" is skipped
        self.assertEqual(self.index["sections"][1]["page"], 4)  # printed page number

    def test_paragraph_dehyphenated_without_running_header(self) -> None:
        texts = [extract.runs_to_text(b["runs"]) for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki") if b["type"] == "paragraph"]
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
        self.assertEqual(extract.runs_to_text(lists[0]["items"][1]), "Kluczyk złożyć do wnętrza obudowy.")
        ordered = [b for b in self.blocks("kluczyki-drzwi-i-szyby/dach") if b["type"] == "list"]
        self.assertTrue(ordered[0]["ordered"])

    def test_warnings(self) -> None:
        warnings = [b for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki") if b["type"] == "warning"]
        self.assertEqual([w["kind"] for w in warnings], ["warning", "note"])
        self.assertEqual(extract.runs_to_text(warnings[0]["blocks"][0]["runs"]), "Nie zostawiać dzieci w samochodzie bez opieki.")
        self.assertEqual(len(warnings[1]["blocks"]), 1)

    def test_images(self) -> None:
        images = [b for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki") if b["type"] == "image"]
        self.assertEqual(len(images), 1)
        self.assertTrue(images[0]["src"].endswith(".webp"))
        rel = images[0]["src"].removeprefix("/assets/manual/")
        self.assertTrue((self.assets / rel).exists())
        texts = " ".join(extract.runs_to_text(b.get("runs", [])) for b in self.blocks("kluczyki-drzwi-i-szyby/kluczyki-zamki"))
        self.assertNotIn(" 1 ", f" {texts} ")  # callout numbers stay in the image
        vector = [b for b in self.blocks("kluczyki-drzwi-i-szyby/dach") if b["type"] == "image"]
        self.assertEqual(len(vector), 1)

    def test_table(self) -> None:
        tmp = Path(self.tmp.name)
        data = json.loads((tmp / "content" / "dane-techniczne.json").read_text("utf-8"))
        table = data["sections"]["dane-techniczne/dane-silnika"][0]
        self.assertEqual(table["type"], "table")
        self.assertEqual(table["rows"][1], ["B16SHT", "125", "170"])


if __name__ == "__main__":
    unittest.main()
