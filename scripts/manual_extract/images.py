"""Rendering illustrations and inline pictograms from the page as WebP."""

from __future__ import annotations

import hashlib
import io
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

from .document import Document
from .model import Item, Span
from .pdf import pymupdf


def is_grayscale(img: Image.Image) -> bool:
    small = img.resize((min(64, img.width), min(64, img.height))).convert("RGB")
    pixels = small.get_flattened_data() if hasattr(small, "get_flattened_data") else small.getdata()
    for r, g, b in pixels:  # type: ignore[misc]
        if abs(r - g) > 12 or abs(g - b) > 12 or abs(r - b) > 12:
            return False
    return True


def _save_webp(img: Image.Image, target: Path, quality: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=quality, method=6)
    target.write_bytes(buf.getvalue())


def render_icon(doc: Document, assets_dir: Path | None, assets_url: str, pno: int, span: Span) -> dict[str, Any] | None:
    """An inline pictogram glyph (button, warning lamp) as an icon run
    `{"icon": src, "w": …, "h": …}`; identical glyphs share one file."""
    if assets_dir is None or span.bbox is None:
        return None
    return render_region(doc, assets_dir, assets_url, pno, span.bbox)


def render_region(
    doc: Document, assets_dir: Path | None, assets_url: str, pno: int, rect: tuple[float, float, float, float], whiten: bool = False
) -> dict[str, Any] | None:
    """A pictogram drawn in a page region as an icon run. With `whiten` an
    even light background (a shaded table row) becomes white."""
    if assets_dir is None:
        return None
    page = doc.pdf[pno]
    try:
        pix = page.get_pixmap(clip=pymupdf.Rect(rect), dpi=doc.args.icon_dpi * 2, alpha=False)
    except Exception:  # pragma: no cover
        return None
    if pix.width < 2 or pix.height < 2:
        return None
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    if whiten:
        img = whiten_background(img)
    ink = ImageOps.invert(img.convert("L")).point([0 if v <= 24 else 255 for v in range(256)])
    box = ink.getbbox()
    if box is None:
        return None
    img = img.crop(box)
    digest = hashlib.sha1(img.tobytes()).hexdigest()[:16]
    if digest in doc.icon_hashes:
        return dict(doc.icon_hashes[digest])
    if is_grayscale(img):
        img = img.convert("L")
    name = f"s-{digest}.webp"
    _save_webp(img, assets_dir / "symbole" / name, 90)
    run = {"icon": f"{assets_url}/symbole/{name}", "w": img.width, "h": img.height}
    doc.icon_hashes[digest] = run
    return dict(run)


def whiten_background(img: Image.Image) -> Image.Image:
    corners = [img.getpixel((0, 0)), img.getpixel((img.width - 1, 0)), img.getpixel((0, img.height - 1)), img.getpixel((img.width - 1, img.height - 1))]
    bg = corners[0]
    if not isinstance(bg, tuple) or min(bg) < 190 or any(max(abs(a - b) for a, b in zip(c, bg)) > 6 for c in corners):  # type: ignore[arg-type]
        return img
    near = lambda p: max(abs(a - b) for a, b in zip(p, bg)) <= 18  # noqa: E731
    out = img.copy()
    out.putdata([(255, 255, 255) if near(p) else p for p in img.getdata()])  # type: ignore[arg-type]
    return out


def cell_graphic(doc: Document, pno: int, box: tuple[float, float, float, float]) -> tuple[float, float, float, float] | None:
    """Area of the pictogram drawn in a table cell (vector paths or a small
    raster image), without cell backgrounds and rules."""
    page = doc.pdf[pno]
    cell = pymupdf.Rect(box)
    area = max(cell.width * cell.height, 1.0)
    found: list[Any] = []
    for d in doc.drawings(page):
        r = pymupdf.Rect(d["rect"])
        if r.width < 1.2 or r.height < 1.2 or not (cell + (-0.5, -0.5, 0.5, 0.5)).contains(r):
            continue
        if r.width * r.height >= area * 0.5:
            continue  # the shading of the cell
        found.append(r)
    for info in page.get_image_info():
        r = pymupdf.Rect(info["bbox"]) & cell
        if not r.is_empty and r.width >= 3 and r.height >= 3 and r.width * r.height < area * 0.9:
            found.append(r)
    if not found:
        return None
    u = pymupdf.Rect(found[0])
    for r in found[1:]:
        u |= r
    if u.width < 3 or u.height < 3:
        return None
    return (u.x0, u.y0, u.x1, u.y1)


def render_image(
    doc: Document,
    assets_dir: Path | None,
    assets_url: str,
    section: dict[str, Any],
    it: Item,
    is_icon: bool,
    printed: int,
) -> dict[str, Any] | None:
    """Image block fields (without id) of an illustration; identical renders
    share one file."""
    if assets_dir is None:
        return None
    page = doc.pdf[it.page]
    dpi = doc.args.icon_dpi if is_icon else doc.args.dpi
    width_pt = it.bbox[2] - it.bbox[0]
    if not is_icon and width_pt > 0:
        # Small illustrations (a third of a page column) get enough pixels
        # for their callout numbers and letters to stay legible.
        dpi = max(dpi, min(doc.args.dpi * 3, round(doc.args.min_width * 72 / width_pt)))
    try:
        pix = page.get_pixmap(clip=pymupdf.Rect(it.bbox), dpi=dpi, alpha=False)
    except Exception as exc:  # pragma: no cover
        print(f"  ! cannot render image on page {it.page + 1}: {exc}", file=sys.stderr)
        return None
    digest = hashlib.sha1(pix.samples).hexdigest()
    alt = f"Ilustracja: {section['title']} (str. {printed})"
    known = doc.image_hashes.get(digest)
    if known is None:
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        max_w = doc.args.max_width
        if img.width > max_w:
            img = img.resize((max_w, round(img.height * max_w / img.width)), Image.Resampling.LANCZOS)
        if is_grayscale(img):
            img = img.convert("L")
        chapter = section["chapter_slug"]
        n = sum(1 for v in doc.image_hashes.values() if v["chapter"] == chapter) + 1
        name = f"p{printed:03d}-{n:02d}.webp"
        _save_webp(img, assets_dir / chapter / name, doc.args.quality)
        known = {"src": f"{assets_url}/{chapter}/{name}", "width": img.width, "height": img.height, "chapter": chapter}
        doc.image_hashes[digest] = known
    block: dict[str, Any] = {"type": "image", "src": known["src"], "width": known["width"], "height": known["height"], "alt": alt}
    if is_icon:
        block["icon"] = True
    else:
        # Share of the page width, so the reader can show column-wide
        # illustrations smaller and side by side.
        block["share"] = round(min(1.0, width_pt / page.rect.width), 2)
    block["page"] = printed
    return block
