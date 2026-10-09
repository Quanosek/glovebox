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

## Code layout

`scripts/extract.py` is only the command line entry point (called by the importer); the
implementation is the `scripts/manual_extract/` package, one module per topic:

| Module                                          | Topic                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `cli.py`, `build.py`                            | arguments; pipeline, section tree and JSON output                                |
| `document.py`, `model.py`                       | state of one PDF (items, body size, pitch, frames); spans and items              |
| `reading.py`                                    | characters, fake bold, symbol fonts, lone markers, running headers, page numbers |
| `tables.py`, `figures.py`, `frames.py`          | rule-only and gridded tables; illustrations; warning boxes                       |
| `layout.py`, `definitions.py`, `leaders.py`     | columns, bands, pitch, paragraphs; definition lists; dot leaders                 |
| `outline.py`, `headings.py`                     | sections from the outline; headings outside the outline                          |
| `builder.py`, `flow.py`, `runs.py`, `images.py` | blocks of a section; continuation rules; inline runs; WebP rendering             |
| `legends.py`                                    | numbered tables without rules ("Nr Obwód" + "1 Moduł sterujący silnika")         |
| `text.py`, `geometry.py`, `pdf.py`              | Polish text helpers and patterns; rectangles; PyMuPDF import                     |

## Algorithm

1. **Pages** — characters with font, size, bbox and baseline (`rawdict`). Bold comes from
   the font flags/name or from "fake bold" (the same glyphs filled and then stroked, found
   with `get_texttrace()`). A PDF line is split at a horizontal gap wider than ~1.6 × font
   size (table cells, legend number and text). Fonts that only draw single glyphs are symbol
   fonts: a glyph followed by a number is a page reference (`{ page }`), any other glyph an
   inline pictogram (`{ icon, w, h }`, rendered from the page into
   `assets/<book>/symbole/`). A lone bullet, step/legend number or pictogram is joined with
   the text beside it. Small raised / lowered digits become Unicode super- and subscripts
   ("cm³", "CO₂", footnote "¹⁾"; titles are compared after NFKC normalisation).
2. **Margins** — running headers/footers are removed: lines in the top/bottom margins
   (`--margin-top/--margin-bottom`, extended to a full-width rule under a header or over a
   footer) repeated on many pages (digits normalised) or equal to outline titles. Printed page
   numbers are read from the margins (dominant offset to the PDF index) or page labels.
3. **Tables** — tables drawn with horizontal rules only (the rules are split into segments at
   the column boundaries: header above or between the first rules, rows split by rules or by a
   new label in the first column or by new values lower down in a value column, multi-row cells
   joined). Cells printed as one PDF line are cut where a word starts at a column boundary after
   a gap wider than a word space; group headers spanning several columns go to the first column
   they cover; a header-only table ("Nr Obwód") is dropped; a table continued from the previous
   page has no header. Rules separated by an empty strip or a caption across a boundary belong
   to different tables. Then `page.find_tables(strategy="lines_strict")` for gridded tables
   (≥ 2 columns; coloured word highlights are not grids); table text is not repeated in
   paragraphs. `--no-tables` disables.
4. **Figures** — raster images plus clustered vector drawings, merged, rendered with
   `get_pixmap(clip=…)` so callout numbers stay in the picture, saved as WebP
   (`--max-width 1200`, `--quality 78`, deduplicated by hash). Small figures
   (`--icon-size`) become inline icons. Callout labels inside figures are dropped from the text.
   Warning boxes are not figures.
5. **Layout** — any number of columns per page: the horizontal projection of all items that
   fit in a column gives the column intervals (gaps = gutters). Items crossing a gutter are
   full-width bands; reading order is band by band, inside a band column by column (left to
   right), each column top to bottom. `--single-column` disables it. Column left edges snap to
   edges used on many pages (a column holding only indented text keeps its indentation). The
   line pitch (most common baseline distance) is measured; a paragraph starts when the baseline
   distance, minus the extra space taken by sub- and superscripts, exceeds it by `--para-gap` ×
   body size.
6. **Sections** — the PDF outline (`get_toc`) defines the hierarchy; levels up to
   `--max-page-level` become pages, deeper entries become headings. A broken outline copy
   (no destinations) is replaced by a working copy nested under a "….pdf" bookmark; entries
   without a page are located by title. Titles are located in the text (up to 5 joined lines
   of one column, preferring a line that starts a block), falling back to the outline
   destination. Chapter tables of contents (dot leaders) are skipped; other dot-leader lines
   (legends of illustrations) become page references. `--skip-title` skips "Spis treści",
   "Skorowidz", …
7. **Blocks** — paragraphs (continued across columns and pages while the sentence is
   unfinished; a list item also when the next column continues it in lower case),
   bullet/numbered lists (indented paragraphs below a bullet belong to the item; "2. bieg" in a
   wrapped sentence and footnotes in smaller print are not steps), definition lists
   ("W górę : podnoszenie siedziska", "HI = praca szybka", including a description column
   aligned on its colon or equals sign), numbered tables (`legends.py`), warnings ("Niebezpieczeństwo", "Ostrzeżenie", "Przestroga", "Uwaga"):
   framed boxes — rectangles or pairs of vertical lines joined by a horizontal one; a box
   broken across columns/pages continues in the next unlabeled box —, notes set off by
   indentation (they end where the text returns to the column edge; a note made of a list keeps
   its bullets) or until a gap of
   `--warning-gap`. Headings come from the outline or font size/weight; a bold line of body
   size is a heading only when it stands alone, a wrapped heading is joined.
8. **Cleanup** — dehyphenation across line breaks (`-` and U+2010; keeps hyphens before
   capitals, e.g. "Start-Stop"), whitespace normalisation.

## Testing

`pnpm test:extract` runs the tests with the interpreter the importer would use
(`scripts/run-python.mjs`: `PYTHON`, then `.venv`, then `python3` / `python` / `py` — the first
with PyMuPDF and Pillow). It builds synthetic vehicle-manual PDFs (`scripts/tests/make_sample_pdf.py`:
two columns, running headers, warnings, lists, a table, an image, page references; and a
three-column layout with column rules, fake bold, symbol fonts, a warning box broken across
columns, an indented note, bullets touching their text and a rule-only table) and checks
the output. Review results from user-provided manuals because PDF layouts and scan quality vary.

The synthetic PDF needs a complete regular/bold font pair with Polish glyphs. The generator
prefers DejaVu Sans, then uses system Georgia on macOS or Windows. Georgia preserves the
fixture's ASCII hyphens when embedded; Arial may map them to soft hyphens during extraction.
It checks the standard
DejaVu directories on Linux, `/System/Library/Fonts/Supplemental`, `/Library/Fonts` and
`~/Library/Fonts` on macOS, and `C:/Windows/Fonts` on Windows. If neither family is available,
install DejaVu Sans in one of the searched directories; the error lists them. These fonts
are only needed for the synthetic tests, not for importing user manuals.

## After extraction

- Check `/ostrzezenia`, a few sections with tables and images, and the search.
- Review `src/config/featureRules.ts` against real Polish section titles — rules match titles
  only.
- Highlights on changed text are re-anchored by quote; unmatched ones are flagged, not lost.
