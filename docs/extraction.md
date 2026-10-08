# Content extraction

The manuals are copyrighted PDFs, so they are not committed. The pipeline converts them into
structured JSON (`database/<car>/<book>/`) and WebP images (`database/<car>/assets/<book>/`,
served as `/media/<car>/<book>/...`), which are committed.

Two entry points use the same `scripts/extract.py`:

- `npm run extract` regenerates the built-in Opel Cascada books listed in
  `scripts/manuals.config.json` (this document);
- the "Dodaj auto" wizard runs it for uploaded PDFs (see `docs/import.md`).

`--book` accepts any lowercase slug (`[a-z0-9-]`), `--assets-url` sets the image URL prefix.

## Running

```bash
python3 -m pip install -r scripts/requirements.txt   # PyMuPDF >= 1.26, Pillow >= 12.3
npm run fetch-manuals                                 # -> manuals/*.pdf (validated %PDF-)
npm run extract                                       # both books
npm run extract -- --book infotainment --max-pages 20 # one book, debug options passed through
```

`scripts/extract.mjs` looks for a Python with PyMuPDF (`.venv`, `python3`, `python`) and runs
`scripts/extract.py` per book from `scripts/manuals.config.json` (paths, title, URL, extra args).
The extractor wipes the book's `*.json` and asset directory before writing.

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

`npm run test:extract` builds a synthetic Opel-like PDF (`scripts/tests/make_sample_pdf.py`:
two columns, running headers, warnings, lists, a table, an image, page references) and checks
the output. The heuristics were developed against this sample because the real PDFs could
not be downloaded in the development sandbox — after the first real extraction review the
result and tune the CLI options in `manuals.config.json` if needed.

## After extraction

- Check `/ostrzezenia`, a few sections with tables and images, and the search.
- Review `src/config/featureRules.ts` against the real section titles (e.g. infotainment
  variant names) — the rules match titles only.
- Highlights on changed text are re-anchored by quote; unmatched ones are flagged, not lost.
