"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  containerText,
  offsetOf,
  offsetsOfRange,
  rangeFromOffsets,
} from "@/lib/anchoring/dom";
import { describe, resolve, type TextRange } from "@/lib/anchoring/textQuote";
import {
  ALL_HIGHLIGHT_NAMES,
  HIGHLIGHT_COLORS,
  highlightName,
} from "@/lib/highlightColors";
import type {
  Highlight as StoredHighlight,
  HighlightColor,
} from "@/lib/storage/schema";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";
import { newId } from "@/lib/storage/store";

interface Props {
  car: string;
  book: string;
  sectionId: string;
  sectionTitle: string;
  href: string;
  children: ReactNode;
}

interface Point {
  x: number;
  y: number;
}

interface PendingSelection extends Point {
  start: number;
  end: number;
  below: boolean;
}

const supportsHighlights = () =>
  typeof CSS !== "undefined" && "highlights" in CSS;

/**
 * Wraps the section text: lets the user highlight any text fragment, paints
 * stored highlights (CSS Custom Highlight API, no DOM mutation) and manages
 * the comments attached to them.
 */
export function HighlightLayer({
  car,
  book,
  sectionId,
  sectionTitle,
  href,
  children,
}: Props) {
  const data = useAppData();
  const hydrated = useHydrated();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [editing, setEditing] = useState<{ id: string; at: Point } | null>(
    null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const highlights = useMemo(
    () =>
      Object.values(data.highlights)
        .filter(
          (h) => h.car === car && h.book === book && h.sectionId === sectionId,
        )
        .sort((a, b) => a.anchor.start - b.anchor.start),
    [data.highlights, car, book, sectionId],
  );

  // Plain text of the section; the server-rendered content never changes.
  const text = useMemo(() => (root ? containerText(root) : null), [root]);

  const resolved = useMemo(() => {
    const map = new Map<string, TextRange>();
    if (text == null) return map;
    for (const h of highlights) {
      const r = resolve(text, h.anchor);
      if (r) map.set(h.id, r);
    }
    return map;
  }, [text, highlights]);

  // Paint highlights.
  useEffect(() => {
    if (!root || !supportsHighlights()) return;
    const groups = new Map<string, Range[]>();
    let active: Range | null = null;
    for (const h of highlights) {
      const r = resolved.get(h.id);
      if (!r) continue;
      const range = rangeFromOffsets(root, r.start, r.end);
      if (!range) continue;
      const name = highlightName(h.color, h.comment.trim().length > 0);
      groups.set(name, [...(groups.get(name) ?? []), range]);
      if (h.id === activeId) active = range;
    }
    for (const name of ALL_HIGHLIGHT_NAMES) {
      const ranges = groups.get(name);
      if (ranges) CSS.highlights.set(name, new Highlight(...ranges));
      else CSS.highlights.delete(name);
    }
    if (active) {
      const hl = new Highlight(active);
      hl.priority = 1;
      CSS.highlights.set("hl-active", hl);
    } else {
      CSS.highlights.delete("hl-active");
    }
  }, [root, highlights, resolved, activeId]);

  useEffect(
    () => () => {
      if (!supportsHighlights()) return;
      for (const name of [...ALL_HIGHLIGHT_NAMES, "hl-active"])
        CSS.highlights.delete(name);
    },
    [],
  );

  const scrollToHighlight = useCallback(
    (id: string) => {
      const r = resolved.get(id);
      if (!root || !r) return false;
      const range = rangeFromOffsets(root, r.start, r.end);
      if (!range) return false;
      const rect = range.getBoundingClientRect();
      window.scrollTo({
        top: window.scrollY + rect.top - window.innerHeight / 3,
        behavior: "smooth",
      });
      setActiveId(id);
      return true;
    },
    [root, resolved],
  );

  // Deep links: #hl-<id>.
  const handledHash = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const onHash = () => {
      const hash = decodeURIComponent(window.location.hash);
      if (!hash.startsWith("#hl-") || handledHash.current === hash) return;
      if (scrollToHighlight(hash.slice(4))) handledHash.current = hash;
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [hydrated, scrollToHighlight]);

  // Track text selection inside the section.
  useEffect(() => {
    if (!root) return;
    const check = (event?: Event) => {
      if (
        event?.target instanceof Node &&
        toolbarRef.current?.contains(event.target)
      )
        return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPending(null);
        return;
      }
      const range = sel.getRangeAt(0).cloneRange();
      if (!range.intersectsNode(root)) {
        setPending(null);
        return;
      }
      if (!root.contains(range.startContainer)) range.setStart(root, 0);
      if (!root.contains(range.endContainer))
        range.setEnd(root, root.childNodes.length);
      const offsets = offsetsOfRange(root, range);
      const full = text ?? containerText(root);
      if (!offsets) {
        setPending(null);
        return;
      }
      let { start, end } = offsets;
      while (start < end && /\s/.test(full[start])) start++;
      while (end > start && /\s/.test(full[end - 1])) end--;
      if (end <= start) {
        setPending(null);
        return;
      }
      setPending({ start, end, ...toolbarPosition(range) });
    };
    // While scrolling only move the toolbar; offsets do not change.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        const pos = toolbarPosition(sel.getRangeAt(0));
        setPending((p) => (p ? { ...p, ...pos } : p));
      });
    };
    const deferred = (e: Event) => window.setTimeout(() => check(e), 0);
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPending(null);
    };
    document.addEventListener("mouseup", deferred);
    document.addEventListener("keyup", deferred);
    document.addEventListener("touchend", deferred);
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseup", deferred);
      document.removeEventListener("keyup", deferred);
      document.removeEventListener("touchend", deferred);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [root, text]);

  // Close the editor on outside click / Escape.
  useEffect(() => {
    if (!editing) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && editorRef.current?.contains(e.target))
        return;
      setEditing(null);
      setActiveId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditing(null);
        setActiveId(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [editing]);

  const create = (color: HighlightColor, withComment: boolean) => {
    if (!root || !pending) return;
    const now = new Date().toISOString();
    const h: StoredHighlight = {
      id: newId(),
      car,
      book,
      sectionId,
      sectionTitle,
      href,
      anchor: describe(containerText(root), pending.start, pending.end),
      color,
      comment: "",
      createdAt: now,
      updatedAt: now,
    };
    updateData((d) => ({ ...d, highlights: { ...d.highlights, [h.id]: h } }));
    window.getSelection()?.removeAllRanges();
    setPending(null);
    if (withComment) {
      setEditing({
        id: h.id,
        at: { x: pending.x, y: pending.below ? pending.y : pending.y + 8 },
      });
      setActiveId(h.id);
    }
  };

  const onRootClick = (e: React.MouseEvent) => {
    if (!root || !hydrated) return;
    if ((e.target as Element).closest("a, button")) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const offset = offsetFromPoint(root, e.clientX, e.clientY);
    if (offset == null) return;
    let hit: { id: string; len: number } | null = null;
    for (const [id, r] of resolved) {
      if (offset >= r.start && offset < r.end) {
        const len = r.end - r.start;
        if (!hit || len < hit.len) hit = { id, len };
      }
    }
    if (hit) {
      setEditing({ id: hit.id, at: { x: e.clientX, y: e.clientY + 12 } });
      setActiveId(hit.id);
    }
  };

  const editingHighlight = editing ? data.highlights[editing.id] : undefined;
  const unsupported = hydrated && !supportsHighlights();

  return (
    <>
      <div
        ref={setRoot}
        onClick={onRootClick}
        className="prose-manual"
        data-highlight-root
      >
        {children}
      </div>

      {pending && (
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label="Zaznacz tekst"
          className="fixed z-50 flex items-center gap-1 border border-silver bg-white p-1 shadow-md"
          style={{
            left: clamp(pending.x, 130, window.innerWidth - 130),
            top: pending.below ? pending.y + 8 : pending.y - 8,
            transform: `translate(-50%, ${pending.below ? "0" : "-100%"})`,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={`Zaznacz: ${c.label}`}
              aria-label={`Zaznacz: ${c.label}`}
              className="h-7 w-7 border border-steel hover:border-ink"
              style={{ background: c.swatch }}
              onClick={() => create(c.id, false)}
            />
          ))}
          <button
            type="button"
            className="btn ml-1 h-7 py-0"
            onClick={() => create("silver", true)}
          >
            Komentarz
          </button>
        </div>
      )}

      {editing && editingHighlight && (
        <HighlightEditor
          ref={editorRef}
          highlight={editingHighlight}
          at={editing.at}
          onClose={() => {
            setEditing(null);
            setActiveId(null);
          }}
        />
      )}

      <section
        className="panel mt-10 print:hidden"
        aria-labelledby="comments-title"
      >
        <h2 id="comments-title" className="panel-title">
          Zaznaczenia i komentarze w tej sekcji ({highlights.length})
        </h2>
        <div className="p-3 text-sm">
          {unsupported && (
            <p className="mb-2 border-l-2 border-red bg-paper px-3 py-1.5 text-graphite">
              Ta przeglądarka nie obsługuje podświetlania tekstu (CSS Custom
              Highlight API). Zaznaczenia i komentarze są zapisane, ale nie są
              widoczne w treści.
            </p>
          )}
          {highlights.length === 0 ? (
            <p className="text-steel">
              Zaznacz fragment tekstu powyżej, aby go wyróżnić kolorem lub dodać
              komentarz.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {highlights.map((h) => {
                const found = text == null || resolved.has(h.id);
                return (
                  <li key={h.id} className="flex gap-3 py-2">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 border border-steel"
                      style={{
                        background: HIGHLIGHT_COLORS.find(
                          (c) => c.id === h.color,
                        )?.swatch,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <q className="block text-ink">
                        {truncate(h.anchor.exact, 180)}
                      </q>
                      {h.comment.trim() ? (
                        <p className="mt-1 whitespace-pre-wrap text-graphite">
                          {h.comment}
                        </p>
                      ) : (
                        <p className="mt-1 text-steel">Brak komentarza</p>
                      )}
                      {!found && (
                        <p className="mt-1 text-xs text-red">
                          Nie odnaleziono tego fragmentu w bieżącej treści
                          (treść mogła zostać zmieniona).
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                      {found && (
                        <button
                          type="button"
                          className="btn h-7 py-0"
                          onClick={() => scrollToHighlight(h.id)}
                        >
                          Pokaż
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn h-7 py-0"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setEditing({
                            id: h.id,
                            at: { x: rect.left, y: rect.bottom + 4 },
                          });
                          setActiveId(h.id);
                        }}
                      >
                        Edytuj
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function HighlightEditor({
  ref,
  highlight,
  at,
  onClose,
}: {
  ref: React.Ref<HTMLDivElement>;
  highlight: StoredHighlight;
  at: Point;
  onClose: () => void;
}) {
  const width = Math.min(320, window.innerWidth - 16);
  const left = clamp(at.x - width / 2, 8, window.innerWidth - width - 8);
  const top = at.y + 280 > window.innerHeight ? Math.max(8, at.y - 300) : at.y;

  const patch = (changes: Partial<StoredHighlight>) =>
    updateData((d) => {
      const current = d.highlights[highlight.id];
      if (!current) return d;
      return {
        ...d,
        highlights: {
          ...d.highlights,
          [highlight.id]: {
            ...current,
            ...changes,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });

  const remove = () => {
    updateData((d) => {
      const next = { ...d.highlights };
      delete next[highlight.id];
      return { ...d, highlights: next };
    });
    onClose();
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Edycja zaznaczenia"
      className="fixed z-50 border border-silver bg-white shadow-lg"
      style={{ left, top, width }}
    >
      <div className="panel-title flex items-center justify-between">
        Zaznaczenie
        <button
          type="button"
          className="text-steel hover:text-red"
          aria-label="Zamknij"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <q className="line-clamp-3 text-sm text-graphite">
          {highlight.anchor.exact}
        </q>
        <div className="flex gap-1" role="radiogroup" aria-label="Kolor">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={highlight.color === c.id}
              title={c.label}
              aria-label={c.label}
              className={`h-7 w-7 border ${
                highlight.color === c.id
                  ? "border-2 border-ink"
                  : "border-steel"
              }`}
              style={{ background: c.swatch }}
              onClick={() => patch({ color: c.id })}
            />
          ))}
        </div>
        <label
          className="text-xs font-semibold tracking-wide text-graphite uppercase"
          htmlFor="hl-comment"
        >
          Komentarz
        </label>
        <textarea
          id="hl-comment"
          className="field min-h-24 resize-y text-sm"
          value={highlight.comment}
          placeholder="Twój komentarz do zaznaczonego fragmentu…"
          autoFocus
          onChange={(e) => patch({ comment: e.target.value })}
        />
        <div className="flex justify-between gap-2">
          <button type="button" className="btn" onClick={remove}>
            Usuń zaznaczenie
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
}

function offsetFromPoint(root: Node, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) return offsetOf(root, pos.offsetNode, pos.offset);
  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) return offsetOf(root, range.startContainer, range.startOffset);
  return null;
}

function toolbarPosition(range: Range): Point & { below: boolean } {
  const rect = range.getBoundingClientRect();
  const header =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--header-h"),
    ) || 56;
  const below = rect.top < header + 56;
  return {
    x: rect.left + rect.width / 2,
    y: below ? rect.bottom : rect.top,
    below,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
