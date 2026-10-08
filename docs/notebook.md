# Notebook ("Notatnik")

Free-form pages independent of the manual text, at `/notatnik`
(`src/app/notatnik/NotebookView.tsx`). `/notatnik?kartka=<id>` opens a given page (used by the
profile page). The profile (`/`) also shows the three most recently edited pages.

- Data: `AppData.notebook.pages: NotePage[]` — `{ id, title, body, createdAt, updatedAt }`.
  Array order is the user-defined order. `body` is Markdown source.
- Operations: create ("+ Nowa kartka", default title `Kartka N`), rename (title input),
  reorder (▲/▼ swaps neighbours), delete (with confirmation).
- Editor: `<textarea>` with ruled-paper background. `NoteEditor` is keyed by page id and
  keeps a local draft; changes are saved after 400 ms of inactivity, and flushed immediately
  when switching pages, unmounting or on `pagehide`. Status shows "Zapisywanie…" / "Zapisano".
- `updatedAt` only changes when title or body actually change.

## Markdown

Modes: "Pisz" (editor), "Podgląd" (rendered) and "Obok siebie" (both; large screens only).
The toolbar and shortcuts (Ctrl/⌘+B, I, K) edit the source via `wrapSelection` and
`toggleLinePrefix` (`src/lib/markdown.ts`).

Supported subset (`parseMarkdown`):

- blocks: `#`/`##`/`###` headings, paragraphs (single newlines become line breaks),
  `-`/`*`/`+` and `1.` lists, task items `- [ ]` / `- [x]`, `>` quotes, fenced code
  blocks, `---` rules;
- inline: `**bold**`, `*italic*` / `_italic_`, `~~strike~~`, `` `code` ``, `[text](url)`.

Rendering (`src/components/Markdown.tsx`) builds React elements from the AST — no raw HTML
is ever injected. Link targets pass through `safeHref`, which only allows `http(s):`,
`mailto:`, site-relative `/…` and `#…`; anything else is rendered as plain text. External
links open in a new tab with `rel="noopener noreferrer"`. Styles: `.prose-note` in
`globals.css`. `markdownToText` produces plain-text excerpts for lists.
