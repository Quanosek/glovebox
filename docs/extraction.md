# Content extraction

Every manual is provided by the user through the “Dodaj auto” wizard. There are no bundled PDFs,
vehicle definitions or per-vehicle extraction presets. The local import pipeline passes each
uploaded document and its metadata to `scripts/extract.py`; it writes structured JSON
(`database/<car>/<book>/`) and WebP images (`database/<car>/assets/<book>/`, served as
`/media/<car>/<book>/...`). The whole `database/` folder is git-ignored.

The extractor accepts the PDF path, book id, output paths, image URL prefix, title and optional
source URL as arguments. The wizard handles those arguments and stages files under
`database/.import-<job>/` before publishing the completed car. Do not add a preset vehicle or
edit generated output by hand.

The extractor requires Python 3.10+, PyMuPDF 1.26+ and Pillow 12.3+; `pnpm test:extract`
exercises its output using a synthetic PDF.

## Algorithm (`scripts/extract.py`)

1. **Pages** — text as spans (font, size, flags, bbox). Running headers/footers are removed:
   lines in the top/bottom margins (`--margin-top/--margin-bottom`) repeated on many pages
   (digits normalised) or equal to outline titles. Printed page numbers are read from the
   margins (dominant offset to the PDF index) or page labels.
2. **Layout** — two-column reading order (full-width bands, then left/right column);
   `--single-column` disables it.
3. **Tables** — `page.find_tables()` (≥ 2 rows and columns); table text is not repeated in
   paragraphs. `--no-tables` disables.
4. **Figures** — raster images plus clustered vector drawings, merged, rendered with
   `get_pixmap(clip=…)` so callout numbers stay in the picture, saved as WebP
   (`--max-width 1200`, `--quality 78`, deduplicated by hash). Small figures
   (`--icon-size`) become inline icons. Callout labels inside figures are dropped from the text.
5. **Sections** — the PDF outline (`get_toc`) defines the hierarchy; levels up to
   `--max-page-level` become pages, deeper entries become headings. Titles are located on
   the page (up to 3 joined lines), falling back to the outline destination.
   `--skip-title` skips "Spis treści", "Skorowidz", …
6. **Blocks** — paragraphs (gap > `--para-gap` × body size), bullet/numbered lists, warnings
   ("Niebezpieczeństwo", "Ostrzeżenie", "Przestroga", "Uwaga"; framed boxes or until a gap of
   `--warning-gap`), bold/italic runs, page references (symbol-font arrow + number →
   `{ page }`), headings by font size/weight.
7. **Cleanup** — dehyphenation across line breaks (keeps hyphens before capitals, e.g.
   "Start-Stop"), whitespace normalisation.

## Testing

`pnpm test:extract` builds a synthetic vehicle-manual PDF (`scripts/tests/make_sample_pdf.py`:
two columns, running headers, warnings, lists, a table, an image, page references) and checks
the output. Review results from user-provided manuals because PDF layouts and scan quality vary.

## After extraction

- Check `/ostrzezenia`, a few sections with tables and images, and the search.
- Review `src/config/featureRules.ts` against real Polish section titles — rules match titles
  only.
- Highlights on changed text are re-anchored by quote; unmatched ones are flagged, not lost.
