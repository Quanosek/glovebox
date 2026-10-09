"""PyMuPDF import with a readable error when the package is missing."""

from __future__ import annotations

import sys

try:
    import pymupdf
except ImportError:  # pragma: no cover - environment check
    sys.stderr.write(
        "PyMuPDF is missing. Install it with:\n"
        "  python -m pip install -r scripts/requirements.txt\n"
    )
    sys.exit(2)

__all__ = ["pymupdf"]
