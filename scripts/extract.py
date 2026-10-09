#!/usr/bin/env python3
"""Extract structured content and illustrations from a vehicle manual PDF.

Run by the PDF import pipeline (`src/lib/server/importer.ts`) or directly:

    python scripts/extract.py --book <id> --pdf <file> --out <dir> \\
        --assets <dir> --assets-url <url> --title <title>

The implementation is the `manual_extract` package next to this file
(see docs/extraction.md).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from manual_extract.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
