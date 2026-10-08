# Highlighting

Users can highlight any text of a section page and pick a colour from the restricted palette.

## Flow

1. `HighlightLayer` (`src/components/HighlightLayer.tsx`) wraps the server-rendered blocks of a
   section in a container (`[data-highlight-root]`).
2. On `mouseup` / `keyup` / `touchend` it reads `window.getSelection()`, clamps the range to the
   container, converts it to character offsets in the container's plain text
   (`offsetsOfRange`, `src/lib/anchoring/dom.ts`) and trims surrounding whitespace.
3. A floating toolbar offers the four colours and "Komentarz" (creates a silver highlight and
   opens the editor).
4. The highlight is stored with an anchor built by `describe()` (`src/lib/anchoring/textQuote.ts`).

## Anchoring

Anchors combine a W3C-style **TextQuoteSelector** and **TextPositionSelector**:

```ts
{
  (exact, prefix, suffix, start, end);
} // prefix/suffix: 32 chars of context
```

`resolve(text, anchor)` tries, in order:

1. **Position fast path** — `text.slice(start, end) === exact`.
2. **Quote search** — every occurrence of `exact` is scored by matching prefix/suffix
   characters and distance from the stored position; the best wins.
3. **Whitespace-normalised search** — same as 2 on text with collapsed whitespace, mapped
   back to original offsets (survives re-extraction that changes line breaks).

If nothing matches the highlight is kept and listed as "Nie odnaleziono tego fragmentu"
in the section's comments panel and in "Moje komentarze" (it is never deleted silently).

Container text is built from all text nodes except those inside `[data-anchor-ignore]`.
Content collapsed by `SectionGate` stays in the DOM, so offsets do not depend on settings.

## Painting

Highlights are painted with the **CSS Custom Highlight API** — no DOM mutation, so React
hydration and anchoring stay stable:

- one `Highlight` per colour: `hl-<color>`; commented ones use `hl-<color>-c` (red underline);
- the active (clicked/linked) one is also added to `hl-active` with priority 1;
- styles live in `public/highlights.css` (the bundler's CSS parser does not know
  `::highlight()` yet).

Browsers without the API (very old ones) still store highlights; the panel shows a note.

## Interaction

- Click inside highlighted text → `caretPositionFromPoint` / `caretRangeFromPoint` → offset →
  innermost highlight → editor popover (colour, comment, delete). Escape/outside click closes.
- Deep link `…/section#hl-<id>` scrolls to the highlight and marks it active.
