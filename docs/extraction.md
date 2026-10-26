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
| `document.py`, `model.py`                       | state of one PDF (items, body size, pitch, frames); spans, items, `Box`          |
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
   fonts: known Unicode arrows and standard Adobe Symbol right-arrow encodings are page
   references (`{ page }`). An unknown encoded glyph is treated as a reference only when
   it precedes at least three distinct numbers and in at least 90 % of its occurrences in
   the document (evidence is per font and glyph, never per manufacturer). Ambiguous symbols,
   including display pictograms followed by mode numbers, remain an
   inline pictogram (`{ icon, w, h }`, rendered from the page into
   `assets/<book>/symbole/`), except standard list-marker glyphs, which remain text. A lone
   bullet, step/legend number or pictogram is joined with the text beside it, keeping the
   character coordinates aligned with the merged text. Bullet glyphs and their source colours
   are retained as optional list metadata so the reader can reproduce coloured markers without
   turning them into icon images. Single Polish letters drawn by a fallback font ("ż", "ść"
   inside a word) are text, not pictograms, and take the style of their word. Direction marks,
   zero-width spaces and BOMs (common in outlines) are removed. Reference arrows include
   "›››" ("››› strona 45", "››› ⚠ zob. Opis na stronie 45": the words before "strona" stay text,
   the number becomes `{ page }`; "››› rys. 3" keeps only the figure label). A closing "»" that
   marks a column or page continuation is dropped.
   Ordinary word spaces are measured separately for each font and size in the document;
   table-cell gaps are compared with those measurements rather than a fixed point width.
   Small raised / lowered digits become Unicode super- and subscripts
   ("cm³", "CO₂", footnote "¹⁾"; titles are compared after NFKC normalisation).
2. **Margins** — running headers/footers are removed: lines in the top/bottom margins
   (`--margin-top/--margin-bottom`, extended to a full-width rule under a header or over a
   footer) repeated on many pages (digits normalised) or equal to outline titles. Printed page
   numbers are read from the margins (dominant offset to the PDF index) or page labels.
3. **Tables** — tables drawn with horizontal rules only (the rules are split into segments at
   the column boundaries: header above or between the first rules, rows split by rules or by a
   new label in the first column or by new values lower down in a value column, multi-row cells
   joined). Aligned cells immediately below the final rule are retained when the table has no
   bottom border; captions, prose, footnotes and large gaps stop that continuation.
   Cells printed as one PDF line are cut where a word starts at a column boundary after
   a gap wider than a word space; group headers spanning several columns go to the first column
   they cover, including headers with an empty label cell. Bold captions present in the document's own
   outline stay outside the table; ordinary data labels are not excluded just because an unrelated
   bookmark has the same wording. A header-only table ("Nr Obwód") is dropped; a table continued from the previous
   page has no header. Rules separated by an empty strip or a caption across a boundary belong
   to different tables. Then `page.find_tables(strategy="lines_strict")` for gridded tables (one
   replaces a rule-only reading of the same area that found fewer filled cells)
   (≥ 2 columns; coloured word highlights are not grids); table text is not repeated in
   paragraphs. On PyMuPDF 2+, `use_layout=False` preserves line-only detection instead of
   inferring unruled grids that can absorb outline captions or duplicate header rows.
   `--no-tables` disables. Each table keeps its cell rectangles; when a cell holds a
   pictogram (font glyph, vector drawing or small raster, e.g. the "Symbol" column of warning
   lamps), a page reference or a link, the block also gets `cells` (runs per cell, aligned with
   the plain-text `rows` that search and data cards use). Cell pictograms are rendered from the
   page; an even light row shading becomes white, and text drawn inside the pictogram (a circled
   number) stays part of it. Merged cells of gridded tables become `spans` (`[colspan, rowspan]`,
   `null` for covered positions) and a header of several rows `headerRows`; a gridded table has
   a header only when its first row is set apart (bold or medium-weight text, or light text on a
   dark fill) from the first data row. A last row spanning the whole table with explanations
   ("X: Nie można zamontować…") becomes paragraphs under the table.
4. **Figures** — raster images plus clustered vector drawings, merged, rendered with
   `get_pixmap(clip=…)` so callout numbers stay in the picture, saved as WebP
   (`--max-width 1200`, `--quality 78`, deduplicated by hash). Illustrations are rendered at
   least `--min-width 800` pixels wide (up to 3 × `--dpi`) so their callout numbers and letters
   stay legible. Every illustration records `share`, its width as a share of the page width; the
   reader shows all illustrations of a book at one scale, consecutive ones side by side. A
   caption ("Rys. 45 Kluczyki samochodowe") printed under an illustration or beside it (to its
   right, level with it) becomes its `caption` and description, wherever the column reading
   order would put it; a caption inside the rendered picture is shown by the picture and not
   repeated as text. Small figures
   (`--icon-size`) become inline icons. Callout labels inside figures are dropped from the text.
   Warning boxes are not figures, and neither are boxes whose drawings are only lines along
   their edges plus small pictograms (cross-reference boxes). Page decoration is left out
   before clustering: drawings bleeding off the page (hatched borders), page-sized backgrounds
   and bars inside the top/bottom margins — otherwise one "figure" covers the whole page and
   its short lines would be dropped as callouts. A short last caption line aligned under a
   longer kept line is not a callout.
5. **Layout** — any number of columns per page: the horizontal projection of all items that
   fit in a column gives the column intervals (gaps = gutters). Items crossing a gutter are
   full-width bands; reading order is band by band, inside a band column by column (left to
   right), each column top to bottom. `--single-column` disables it. Column left edges snap to
   edges used on many pages (a column holding only indented text keeps its indentation).
   Narrow strips containing isolated legend markers are joined with their indented descriptions
   when both belong to the same recurring column edge; genuine additional columns remain separate.
   A second pass uses the column edges recurring in the document: a cluster is split where at
   least two lines start at such an edge and at most three lines (titles, captions) cross it, so
   a short legend column under a full-width illustration stays a column.
   Up to three lines much wider than the others (a footnote under two columns) do not join the
   columns they cross when the remaining lines form clear columns; they become full-width bands.
   A lone number with text right before it on its baseline ("nicy . . . 58") ends that line and
   is not merged as a legend number. Page numbers drawn separately to the right of a
   dot-leader line are joined by baseline and proximity before column detection, so
   they cannot become separate columns or reorder a numbered legend.
   Footnotes in small print at the bottom of a column
   ("1) COC = …") are read after the page and emitted after the block they interrupted. The
   line pitch (most common baseline distance) is measured for the body text and for every text
   style (font, size) that wraps; a paragraph starts when the baseline distance, minus the extra
   space taken by sub- and superscripts, exceeds the pitch by `--para-gap` × body size (a style
   with a looser leading may raise the pitch by at most 25 %, never lower it).
   Changes between ordinary and emphasised text start a new block even with tight spacing,
   when either line starts in upper case; they do not split a hyphenated word, lower-case
   sentence continuations or a bullet whose marker has a different weight.
   For short documents without a measured style pitch, aligned, same-style emphasised
   lines continuing in lower case allow up to 25 % extra leading.
6. **Sections** — the PDF outline (`get_toc`) defines the hierarchy; levels up to
   `--max-page-level` become pages, deeper entries become headings. A broken outline copy
   (no destinations) is replaced by a working copy nested under a "….pdf" bookmark; entries
   without a page are located by title. Titles are located in the text (joined lines
   of one column, preferring a line that starts a block), falling back to the outline
   destination. Wrapped titles are not limited to five lines; titles are compared without
   whitespace around a slash or before punctuation, optional-equipment asterisks
   ("Climatronic* sterowanie"), footnote marks ("Nawigacja¹⁾"), quotes and pictogram glyphs.
   A category without text of its own and with exactly one sub-category is one page (the
   sub-category title becomes a heading unless it repeats the category title; its sub-entries
   stay headings). A category whose sub-categories have no deeper entries is one page with the
   sub-categories as headings instead of a page per sub-category. Heading levels count from the
   page an entry belongs to. With no PDF outline, adjacent hyphenated heading lines
   in the same column are joined before sections are created. Unmatched outline entries are reported; their bookmark
   text is not inserted as a fabricated heading in the manual body.
   A two-page spread — an illustration printed alone on a page, its numbered legend ("1",
   "A") starting on the next page under new section titles — is read with the illustration
   right above that legend, in the section that holds the legend (`move_spread_figures`).
   Chapter tables of contents (dot leaders) are skipped; other dot-leader lines
   (legends of illustrations) become page references. Pages containing circled legend
   markers are not mistaken for chapter tables of contents. `--skip-title` skips "Spis treści",
   "Skorowidz", …
7. **Blocks** — paragraphs (continued across columns and pages while the sentence is
   unfinished; a list item also when the next column continues it in lower case),
   legends under illustrations (a digit or capital letter in a drawn circle, "Ⓐ Kontrola
   poziomu", is joined with the text beside it and becomes a list item whose marker is that
   mark in its enclosed Unicode form, "①"–"㊿", "Ⓐ"–"Ⓩ", in the colour of the circle).
   Legends keep their hanging indentation: column-edge prose ends the legend, and
   following ordinary bullets start a separate list. Flush bullet continuation rules do
   not apply to legends. Bullet/numbered lists (indented paragraphs below a bullet belong to the item; in documents
   whose bullets have no hanging indent — measured per document — the wrapped lines start under
   the bullet and continue the item until a paragraph gap; "2. bieg" in a wrapped sentence and
   footnotes in smaller print are not steps; a dash starts an item when it starts a new block;
   a bullet glyph wins over the "Term : description" form and a pictogram is never a bullet;
   a line continuing an unfinished sentence, or the rest of a printed line cut by a pictogram,
   stays in its item), definition lists (no marker is invented for them; a lower-case "term"
   after a word broken at the line end continues that sentence)
   ("W górę : podnoszenie siedziska", "HI = praca szybka", including a description column
   aligned on its colon or equals sign), numbered tables (`legends.py`), warnings ("Niebezpieczeństwo", "Ostrzeżenie", "Przestroga",
   "Ostrożnie", "Uwaga", "Informacja"; the label starts with a capital, so "…następująca /
   informacja:" stays a sentence; a label on a bar just above a box adopts that box):
   framed boxes — rectangles or pairs of vertical lines joined by a horizontal one; a box
   broken across columns/pages continues in the next unlabeled box —, notes set off by
   indentation (they end where the text returns to the column edge; a note made of a list keeps
   its bullets) or until a gap of
   `--warning-gap`. Headings come from the outline or font size/weight; a bold (or medium
   weight) line of body size is a heading only when it stands alone, or when a short paragraph
   set entirely in that style wraps over several lines that are not table cells; a wrapped
   heading is joined. Medium-weight lead-in sentences ending in ":" or "!" are not headings.
8. **Cleanup** — dehyphenation across line breaks (`-` and U+2010; keeps hyphens before
   capitals, e.g. "Start-Stop"; an internet address broken after "/", "." or "-" is joined
   without a space), whitespace normalisation. Internet addresses (`http(s)://…`, `www.…`)
   become link runs `{ t, href }`; the reader opens them in a new tab. Only `http(s)` targets
   are produced.

## Testing

`pnpm test:extract` runs the tests with the interpreter the importer would use
(`scripts/run-python.mjs`: `PYTHON`, then `.venv`, then `python3` / `python` / `py` — the first
with PyMuPDF and Pillow). It builds synthetic vehicle-manual PDFs (`scripts/tests/make_sample_pdf.py`:
two columns, running headers, warnings, lists, a table, an image, page references; and a
three-column layout with column rules, fake bold, symbol fonts, a warning box broken across
columns, an indented note, bullets touching their text and a rule-only table) and checks
the output. `test_document_patterns.py` additionally checks scaled PDFs, open-bottom tables,
textual table values, grouped headers, captions versus unrelated bookmark labels, merged marker
coordinates, document-specific spacing, sparse legend columns and genuine four-column layouts.
It also checks that absent bookmark text is not invented as body content.
Review results from user-provided manuals because PDF layouts and scan quality vary.

`pnpm lint:py` checks the package with ruff (`scripts/ruff.toml`: pyflakes, import order,
bugbear, pyupgrade; long lines allowed). A refactor of the extractor must keep its output:
re-extract the local manuals into a temporary folder and compare every JSON file with the
current `database/` before replacing it. Lines are copied with `Span.copy()` and
`Item.with_spans()`; `SectionBuilder._line()` is a pipeline of named steps (footnote, warning
label, heading, legend entry, definition, list item, continuation, paragraph).

The synthetic PDF needs a complete regular/bold font pair with Polish glyphs. The generator
prefers DejaVu Sans, then uses system Georgia on macOS or Windows. Georgia preserves the
fixture's ASCII hyphens when embedded; Arial may map them to soft hyphens during extraction.
Fixture text must fit its column with either supported font family; the three-column tests
check the rendered line bounds to catch font-dependent overflow into gutters.
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
