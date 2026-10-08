"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { confirmDialog } from "@/components/Dialog";
import { Markdown } from "@/components/Markdown";
import {
  markdownToText,
  toggleLinePrefix,
  wrapSelection,
  type EditResult,
} from "@/lib/markdown";
import type { NotePage } from "@/lib/storage/schema";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";
import { newId } from "@/lib/storage/store";

const AUTOSAVE_MS = 400;

export function NotebookView({ initialPage }: { initialPage?: string }) {
  const { notebook } = useAppData();
  const hydrated = useHydrated();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPage ?? null,
  );
  const pages = notebook.pages;
  const selected = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  if (!hydrated) return <p className="mt-4 text-steel">Ładowanie…</p>;

  const create = () => {
    const now = new Date().toISOString();
    const page: NotePage = {
      id: newId(),
      title: `Kartka ${pages.length + 1}`,
      body: "",
      createdAt: now,
      updatedAt: now,
    };
    updateData((d) => ({
      ...d,
      notebook: { pages: [...d.notebook.pages, page] },
    }));
    setSelectedId(page.id);
  };

  const move = (id: string, delta: -1 | 1) =>
    updateData((d) => {
      const list = [...d.notebook.pages];
      const i = list.findIndex((p) => p.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, notebook: { pages: list } };
    });

  const remove = async (page: NotePage) => {
    const ok = await confirmDialog({
      title: "Usunąć kartkę?",
      message: `Kartka „${page.title || "bez tytułu"}” zostanie usunięta razem z całą treścią. Tej operacji nie można cofnąć.`,
      confirmLabel: "Usuń kartkę",
      danger: true,
    });
    if (!ok) return;
    updateData((d) => ({
      ...d,
      notebook: { pages: d.notebook.pages.filter((p) => p.id !== page.id) },
    }));
    if (selectedId === page.id) setSelectedId(null);
  };

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[16rem_1fr]">
      <aside className="panel self-start">
        <div className="panel-title flex items-center justify-between">
          Kartki ({pages.length})
        </div>
        <ul className="divide-y divide-line">
          {pages.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-stretch ${selected?.id === p.id ? "border-l-2 border-red bg-paper" : "border-l-2 border-transparent"}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                aria-current={selected?.id === p.id ? "true" : undefined}
                onClick={() => setSelectedId(p.id)}
              >
                <span className="block truncate">
                  {p.title || "Bez tytułu"}
                </span>
                {p.body.trim() && (
                  <span className="block truncate text-xs text-graphite">
                    {markdownToText(p.body).slice(0, 80)}
                  </span>
                )}
                <span className="block text-xs text-steel">
                  {new Date(p.updatedAt).toLocaleString("pl-PL")}
                </span>
              </button>
              <div className="flex flex-col border-l border-line">
                <button
                  type="button"
                  className="px-2 text-xs text-steel hover:text-ink disabled:opacity-30"
                  disabled={i === 0}
                  aria-label="Przenieś wyżej"
                  onClick={() => move(p.id, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="px-2 text-xs text-steel hover:text-ink disabled:opacity-30"
                  disabled={i === pages.length - 1}
                  aria-label="Przenieś niżej"
                  onClick={() => move(p.id, 1)}
                >
                  ▼
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-line p-2">
          <button
            type="button"
            className="btn btn-primary w-full justify-center"
            onClick={create}
          >
            + Nowa kartka
          </button>
        </div>
      </aside>

      {selected ? (
        <NoteEditor
          key={selected.id}
          page={selected}
          onDelete={() => void remove(selected)}
        />
      ) : (
        <div className="panel flex min-h-80 items-center justify-center p-6 text-center text-steel">
          <div>
            <p>Notatnik jest pusty.</p>
            <p className="mt-1 text-sm">
              Utwórz pierwszą kartkę, aby zapisywać własne notatki poza tekstem
              instrukcji.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteEditor({
  page,
  onDelete,
}: {
  page: NotePage;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [status, setStatus] = useState<"saved" | "pending">("saved");
  const [mode, setMode] = useState<Mode>("edit");
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const draft = useRef({ title: page.title, body: page.body });

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const { title: t, body: b } = draft.current;
    updateData((d) => ({
      ...d,
      notebook: {
        pages: d.notebook.pages.map((p) =>
          p.id === page.id && (p.title !== t || p.body !== b)
            ? { ...p, title: t, body: b, updatedAt: new Date().toISOString() }
            : p,
        ),
      },
    }));
    setStatus("saved");
  };

  const schedule = (next: { title: string; body: string }) => {
    draft.current = next;
    setStatus("pending");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_MS);
  };

  const apply = (run: Tool["run"]) => {
    const el = area.current;
    if (!el) return;
    const r = run(el.value, el.selectionStart, el.selectionEnd);
    setBody(r.value);
    schedule({ title, body: r.value });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.start, r.end);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const tool = TOOLS.find(
      (t): t is Tool => t !== "|" && t.key === e.key.toLowerCase(),
    );
    if (tool) {
      e.preventDefault();
      apply(tool.run);
    }
  };

  // Save pending changes when switching pages or leaving.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    const onHide = () => timer.current !== undefined && flushRef.current();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, []);

  return (
    <section className="panel flex min-h-112 flex-col">
      <div className="silver-bar flex flex-wrap items-center gap-2 px-3 py-2">
        <input
          className="field min-w-0 flex-1 border-transparent bg-transparent text-lg font-semibold hover:border-line focus:border-silver focus:bg-white"
          value={title}
          aria-label="Tytuł kartki"
          placeholder="Tytuł kartki"
          onChange={(e) => {
            setTitle(e.target.value);
            schedule({ title: e.target.value, body });
          }}
        />
        <span className="text-xs text-steel" aria-live="polite">
          {status === "saved" ? "Zapisano" : "Zapisywanie…"}
        </span>
        <button type="button" className="btn" onClick={onDelete}>
          Usuń kartkę
        </button>
      </div>
      <div
        role="toolbar"
        aria-label="Formatowanie tekstu"
        className="flex flex-wrap items-center gap-px border-b border-line bg-paper px-2 py-1"
      >
        {TOOLS.map((t, i) =>
          t === "|" ? (
            <span key={`sep-${i}`} className="mx-1 h-5 w-px bg-line" />
          ) : (
            <button
              key={t.label}
              type="button"
              className="btn btn-ghost h-8 min-w-8 justify-center px-2 text-sm"
              title={t.label + (t.key ? ` (Ctrl+${t.key.toUpperCase()})` : "")}
              aria-label={t.label}
              disabled={mode === "preview"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(t.run)}
            >
              <span aria-hidden="true" className={t.className}>
                {t.icon}
              </span>
            </button>
          ),
        )}
        <div className="ml-auto flex" role="group" aria-label="Widok">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              className={`btn h-8 px-2.5 text-xs ${m.id === "split" ? "hidden lg:inline-flex" : ""} ${
                mode === m.id ? "btn-primary" : ""
              }`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`grid flex-1 ${mode === "split" ? "lg:grid-cols-2 lg:divide-x lg:divide-line" : ""}`}
      >
        {mode !== "preview" && (
          <textarea
            ref={area}
            className="min-h-96 w-full flex-1 resize-y bg-[linear-gradient(transparent_calc(1.75rem-1px),var(--color-line)_1.75rem)] bg-size-[100%_1.75rem] bg-local px-4 py-[0.4rem] font-mono text-[0.95rem] leading-7 outline-none"
            value={body}
            aria-label="Treść notatki"
            placeholder={PLACEHOLDER}
            onKeyDown={onKeyDown}
            onChange={(e) => {
              setBody(e.target.value);
              schedule({ title, body: e.target.value });
            }}
          />
        )}
        {mode !== "edit" && (
          <div className="min-h-96 overflow-auto px-5 py-3">
            {body.trim() ? (
              <Markdown source={body} />
            ) : (
              <p className="text-steel">Kartka jest pusta.</p>
            )}
          </div>
        )}
      </div>
      <p className="border-t border-line px-3 py-1.5 text-xs text-steel">
        Notatki zapisują się same w tej przeglądarce. Użyj przycisków powyżej
        albo prostych znaków, np. gwiazdek do pogrubienia, # do nagłówka, - do
        listy i &gt; do cytatu. Liczba znaków: {body.length}
      </p>
    </section>
  );
}

type Mode = "edit" | "preview" | "split";

const MODES: { id: Mode; label: string }[] = [
  { id: "edit", label: "Pisz" },
  { id: "preview", label: "Podgląd" },
  { id: "split", label: "Obok siebie" },
];

const PLACEHOLDER = `Pisz tutaj… Możesz formatować tekst, np.:
## Nagłówek
**pogrubienie**, *kursywa*
- lista
- [ ] zadanie do zrobienia`;

interface Tool {
  label: string;
  icon: string;
  className?: string;
  key?: string;
  run: (value: string, start: number, end: number) => EditResult;
}

const TOOLS: Array<Tool | "|"> = [
  {
    label: "Pogrubienie",
    icon: "B",
    className: "font-bold",
    key: "b",
    run: (v, s, e) => wrapSelection(v, s, e, "**"),
  },
  {
    label: "Kursywa",
    icon: "I",
    className: "italic font-serif",
    key: "i",
    run: (v, s, e) => wrapSelection(v, s, e, "*"),
  },
  {
    label: "Przekreślenie",
    icon: "S",
    className: "line-through",
    run: (v, s, e) => wrapSelection(v, s, e, "~~"),
  },
  {
    label: "Tekst stały",
    icon: "</>",
    className: "font-mono text-xs",
    run: (v, s, e) => wrapSelection(v, s, e, "`"),
  },
  "|",
  {
    label: "Nagłówek",
    icon: "H",
    className: "font-semibold",
    run: (v, s, e) => toggleLinePrefix(v, s, e, "## "),
  },
  {
    label: "Lista",
    icon: "•",
    run: (v, s, e) => toggleLinePrefix(v, s, e, "- "),
  },
  {
    label: "Lista numerowana",
    icon: "1.",
    className: "text-xs",
    run: (v, s, e) => toggleLinePrefix(v, s, e, "{n}. "),
  },
  {
    label: "Lista zadań",
    icon: "☐",
    run: (v, s, e) => toggleLinePrefix(v, s, e, "- [ ] "),
  },
  {
    label: "Cytat",
    icon: "❝",
    run: (v, s, e) => toggleLinePrefix(v, s, e, "> "),
  },
  "|",
  {
    label: "Link",
    icon: "↗",
    key: "k",
    run: (v, s, e) => {
      const text = v.slice(s, e) || "opis";
      const insert = `[${text}](https://)`;
      const value = v.slice(0, s) + insert + v.slice(e);
      const urlStart = s + text.length + 3;
      return { value, start: urlStart, end: urlStart + 8 };
    },
  },
  {
    label: "Linia pozioma",
    icon: "―",
    run: (v, s) => {
      const before = s > 0 && v[s - 1] !== "\n" ? "\n\n" : "";
      const value = `${v.slice(0, s)}${before}---\n${v.slice(s)}`;
      const pos = s + before.length + 4;
      return { value, start: pos, end: pos };
    },
  },
];
