"""Command line of the extractor (used by the PDF import pipeline)."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from .build import build

DESCRIPTION = """Extract structured content and illustrations from a vehicle manual PDF.

Produces the JSON format described in `src/content/types.ts`:

    <out>/index.json            book index (flat table of contents)
    <out>/<chapter-slug>.json   blocks for every section of one chapter
    <assets>/<chapter-slug>/*.webp
    <assets>/symbole/*.webp     inline pictograms

The steps live in the `manual_extract` package (see docs/extraction.md).
"""


def book_id(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", value):
        raise argparse.ArgumentTypeError("book id must be a lowercase slug (a-z, 0-9, -)")
    return value


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=DESCRIPTION, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--book", required=True, type=book_id, help="book id (lowercase slug), also the output directory name")
    p.add_argument("--pdf", required=True)
    p.add_argument("--out", required=True, help="output directory for JSON")
    p.add_argument("--assets", required=True, help="output directory for WebP images")
    p.add_argument("--assets-url", required=True, help="public URL prefix of --assets")
    p.add_argument("--title", required=True)
    p.add_argument("--source-url", default="")
    p.add_argument("--max-page-level", type=int, default=2, help="outline levels rendered as separate pages")
    p.add_argument("--skip-title", default=r"^(spis treści|skorowidz|indeks)$")
    p.add_argument("--ref-font", default=r"symbol|dingbat|wingding|pictogram|arrow|opelsym|opel-sym")
    p.add_argument("--margin-top", type=float, default=0.07)
    p.add_argument("--margin-bottom", type=float, default=0.07)
    p.add_argument("--para-gap", type=float, default=0.15, help="extra space over the normal line pitch (× body size) that starts a new paragraph")
    p.add_argument("--warning-gap", type=float, default=1.2, help="extra space over the line pitch (× body size) that ends an unframed warning")
    p.add_argument("--single-column", action="store_true")
    p.add_argument("--dpi", type=int, default=144)
    p.add_argument("--icon-dpi", type=int, default=192)
    p.add_argument("--icon-size", type=float, default=30.0, help="figures smaller than this (pt) are icons")
    p.add_argument("--min-icon", type=float, default=6.0)
    p.add_argument("--min-figure", type=float, default=36.0)
    p.add_argument("--callout-max-chars", type=int, default=12)
    p.add_argument("--max-width", type=int, default=1200)
    p.add_argument("--quality", type=int, default=78)
    p.add_argument("--no-images", action="store_true")
    p.add_argument("--no-vector", action="store_true", help="only extract raster images")
    p.add_argument("--no-tables", action="store_true")
    p.add_argument("--max-pages", type=int, default=0, help="debug: only process the first N pages")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not Path(args.pdf).exists():
        print(f"PDF not found: {args.pdf}. Select a valid manual PDF.", file=sys.stderr)
        return 1
    build(args)
    return 0
