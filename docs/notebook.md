# Notebook ("Notatnik")

Free-form pages independent of the manual text, at `/notatnik`
(`src/app/notatnik/NotebookView.tsx`).

- Data: `AppData.notebook.pages: NotePage[]` — `{ id, title, body, createdAt, updatedAt }`.
  Array order is the user-defined order.
- Operations: create ("+ Nowa kartka", default title `Kartka N`), rename (title input),
  reorder (▲/▼ swaps neighbours), delete (with confirmation).
- Editor: plain `<textarea>` with ruled-paper background. `NoteEditor` is keyed by page id and
  keeps a local draft; changes are saved after 400 ms of inactivity, and flushed immediately
  when switching pages, unmounting or on `pagehide`. Status shows "Zapisywanie…" / "Zapisano".
- `updatedAt` only changes when title or body actually change.
