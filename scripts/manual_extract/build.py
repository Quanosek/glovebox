"""Extraction pipeline: PDF -> book index + chapter JSON files + WebP images."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .builder import SectionBuilder
from .document import Document
from .figures import add_tables_and_figures
from .layout import assign_layout
from .leaders import mark_toc_lines
from .outline import locate_entries, outline
from .reading import read_pages
from .text import clean_text, normalize_title, slugify

FORMAT_VERSION = 1


def analyse(args: argparse.Namespace) -> Document:
    """Read the PDF and put its items in reading order."""
    doc = Document(args)
    print(f"→ {args.pdf}: {doc.page_count} pages")
    read_pages(doc)
    print(f"  body font size: {doc.body_size}")
    add_tables_and_figures(doc)
    assign_layout(doc)
    return doc


def prepare_output(out_dir: Path, assets_dir: Path | None) -> None:
    """Generated content is fully replaced."""
    if out_dir.exists():
        for f in out_dir.glob("*.json"):
            f.unlink()
    out_dir.mkdir(parents=True, exist_ok=True)
    if assets_dir is not None:
        if assets_dir.exists():
            shutil.rmtree(assets_dir)
        assets_dir.mkdir(parents=True, exist_ok=True)


class SectionTree:
    """Section pages of a book: unique slug paths under their parents."""

    def __init__(self, doc: Document, max_page_level: int) -> None:
        self.doc = doc
        self.max_page_level = max_page_level
        self.sections: list[dict[str, Any]] = []
        self.chapters: dict[str, dict[str, Any]] = {}
        self.stack: list[dict[str, Any]] = []  # page-level sections by level
        self.used_slugs: dict[str | None, set[str]] = {}

    def add(self, entry: dict[str, Any]) -> dict[str, Any]:
        level = min(entry["level"], self.max_page_level)
        while self.stack and self.stack[-1]["level"] >= level:
            self.stack.pop()
        parent = self.stack[-1] if self.stack else None
        if parent is None and level > 1:
            level = 1
        parent_id = parent["id"] if parent else None
        siblings = self.used_slugs.setdefault(parent_id, set())
        base = slugify(entry["title"])
        slug = base
        k = 2
        while slug in siblings:
            slug = f"{base}-{k}"
            k += 1
        siblings.add(slug)
        path = (parent["slug"] if parent else []) + [slug]
        chapter_slug = path[0]
        section = {
            "id": "/".join(path),
            "slug": path,
            "title": entry["title"],
            "level": level,
            "parentId": parent_id,
            "page": self.doc.printed.get(entry["page"], entry["page"] + 1),
            "file": f"{chapter_slug}.json",
            "chapter_slug": chapter_slug,
        }
        self.sections.append(section)
        self.stack.append(section)
        self.chapters.setdefault(chapter_slug, {"formatVersion": FORMAT_VERSION, "sections": {}})
        return section

    def store(self, section: dict[str, Any], blocks: list[dict[str, Any]]) -> None:
        self.chapters[section["chapter_slug"]]["sections"][section["id"]] = blocks


def assemble(doc: Document, args: argparse.Namespace, assets_dir: Path | None) -> SectionTree:
    """Feed the items of every outline entry to the builder of its page."""
    entries = outline(doc)
    positions = locate_entries(doc, entries)
    skip_re = re.compile(args.skip_title, re.I) if args.skip_title else None
    tree = SectionTree(doc, args.max_page_level)
    bounds = positions + [len(doc.items)]
    for n in range(len(entries)):
        mark_toc_lines(doc, positions[n], max(positions[n], bounds[n + 1]))
    own_text = [has_own_text(doc, positions[n] + e.get("span", 0), bounds[n + 1]) for n, e in enumerate(entries)]
    merge_lone_children(entries, own_text, args.max_page_level)
    inline_leaf_children(entries, args.max_page_level)
    skip_level: int | None = None
    current: dict[str, Any] | None = None
    builder: SectionBuilder | None = None

    def finish_current() -> None:
        if builder is not None and current is not None:
            tree.store(current, builder.finish())

    for n, e in enumerate(entries):
        start, end = positions[n], max(positions[n], bounds[n + 1])
        if skip_level is not None and e["level"] > skip_level:
            continue
        skip_level = None
        if skip_re and skip_re.search(e["title"]):
            skip_level = e["level"]
            finish_current()
            current, builder = None, None
            continue
        title_span = e.get("span", 0)
        if (e.get("merged") or e.get("inline")) and builder is not None:
            # Part of its parent's page: its title (unless it repeats the
            # parent's) becomes a heading.
            heading_items = [it for it in doc.items[start : start + title_span] if it.kind == "line"]
            if heading_items and not (e.get("merged") and e.get("same_title")):
                builder.heading(heading_items, 2)
        elif e["level"] <= args.max_page_level or current is None or builder is None:
            finish_current()
            current = tree.add(e)
            builder = SectionBuilder(doc, current, assets_dir, args.assets_url)
        else:
            # Heading levels count from the page the entry is part of.
            level = e["level"] - (current["level"] if current else args.max_page_level) + 1
            heading_items = [it for it in doc.items[start : start + title_span] if it.kind == "line"]
            if heading_items:
                builder.heading(heading_items, level)
        for it in doc.items[start + title_span : end]:
            if not it.data.get("toc"):
                builder.feed(it)
    finish_current()
    return tree


def has_own_text(doc: Document, start: int, end: int) -> bool:
    """True when an entry has text or a table before its first sub-entry."""
    for it in doc.items[start:end]:
        if it.kind == "table" or (it.kind == "line" and not it.data.get("toc") and clean_text(it.plain)):
            return True
    return False


def subtree_end(entries: list[dict[str, Any]], n: int) -> int:
    return next((k for k in range(n + 1, len(entries)) if entries[k]["level"] <= entries[n]["level"]), len(entries))


def merge_lone_children(entries: list[dict[str, Any]], own_text: list[bool], max_page_level: int) -> None:
    """A category without text of its own and with exactly one sub-category
    ("Dane techniczne" › "Informacje o danych technicznych") is one page:
    the sub-category is merged into it; its sub-entries stay headings."""
    for n, e in enumerate(entries[:-1]):
        if e["level"] >= max_page_level or own_text[n]:
            continue
        child = entries[n + 1]
        end = subtree_end(entries, n)
        if child["level"] != e["level"] + 1 or any(entries[k]["level"] == child["level"] for k in range(n + 2, end)):
            continue
        child["merged"] = True
        child["same_title"] = normalize_title(child["title"]) == normalize_title(e["title"])


def inline_leaf_children(entries: list[dict[str, Any]], max_page_level: int) -> None:
    """A category whose sub-categories have no deeper entries is one page
    with the sub-categories as headings, not a page per sub-category."""
    for n, e in enumerate(entries):
        if e.get("merged") or e["level"] >= max_page_level:
            continue
        end = subtree_end(entries, n)
        children = [k for k in range(n + 1, end) if not entries[k].get("merged")]
        if children and all(entries[k]["level"] == e["level"] + 1 for k in children):
            for k in children:
                entries[k]["inline"] = True


def write_output(doc: Document, args: argparse.Namespace, out_dir: Path, tree: SectionTree) -> dict[str, Any]:
    for slug, data in tree.chapters.items():
        (out_dir / f"{slug}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    index = {
        "formatVersion": FORMAT_VERSION,
        "id": args.book,
        "title": args.title,
        "source": {
            "url": args.source_url,
            "file": Path(args.pdf).name,
            "extractedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "pages": doc.page_count,
        },
        "sections": [{k: v for k, v in s.items() if k != "chapter_slug"} for s in tree.sections],
    }
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    return index


def build(args: argparse.Namespace) -> dict[str, Any]:
    out_dir = Path(args.out)
    assets_dir = None if args.no_images else Path(args.assets)
    doc = analyse(args)
    prepare_output(out_dir, assets_dir)
    tree = assemble(doc, args, assets_dir)
    index = write_output(doc, args, out_dir, tree)
    print(f"  sections: {len(tree.sections)}, chapters: {len(tree.chapters)}, unique images: {len(doc.image_hashes)}")
    return index
