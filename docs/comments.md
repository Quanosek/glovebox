# Comments

A comment is the `comment` field of a highlight (`Highlight.comment`, plain text). There is no
separate comment entity, so deleting a highlight deletes its comment.

- **Create/edit:** select text → "Komentarz", or click an existing highlight → editor popover.
  Every keystroke updates the store (localStorage write is cheap for this data size).
- **Per-section panel:** under the content of each section, `HighlightLayer` lists all
  highlights of the section ordered by position, with "Pokaż" (scroll + activate) and
  "Edytuj".
- **Global list:** `/komentarze` (`src/app/komentarze/CommentsView.tsx`) groups all highlights
  by section, can filter to commented ones only, links to `href#hl-<id>` and allows deletion.
- Highlights with a non-empty comment are painted with an extra red underline
  (`hl-<color>-c`).
