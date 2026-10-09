"""Extraction of vehicle manual PDFs into the content format of the app
(`src/content/types.ts`). Entry point: `scripts/extract.py`.

Steps, in order (each module is one topic):

- `reading`      characters, "fake bold", symbol fonts, running headers
- `figures`      tables (`tables`) and illustrations; warning boxes (`frames`)
- `layout`       reading order of columns and bands, line pitch, paragraphs;
                 definition lists (`definitions`) and dot leaders (`leaders`)
- `outline`      sections from the PDF bookmarks, located in the text
- `builder`      content blocks of one section (`flow`, `headings`, `images`,
                 `legends`, `runs`)
- `build`        the pipeline and the JSON output; `cli` parses arguments

Shared pieces: `document` (state of one PDF), `model` (spans and items),
`text` (Polish text helpers and patterns), `geometry` (rectangles), `pdf`
(PyMuPDF import).
"""
