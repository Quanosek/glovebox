"use client";

import { useEffect, useRef, useState } from "react";
import type { NotePage } from "@/lib/storage/schema";
import { updateData, useAppData, useHydrated } from "@/lib/storage/hooks";
import { newId } from "@/lib/storage/store";

const AUTOSAVE_MS = 400;

export function NotebookView() {
  const { notebook } = useAppData();
  const hydrated = useHydrated();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pages = notebook.pages;
  const selected = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  if (!hydrated) return <p className="mt-4 text-steel">Ładowanie…</p>;

  const create = () => {
    const now = new Date().toISOString();
    const page: NotePage = { id: newId(), title: `Kartka ${pages.length + 1}`, body: "", createdAt: now, updatedAt: now };
    updateData((d) => ({ ...d, notebook: { pages: [...d.notebook.pages, page] } }));
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

  const remove = (page: NotePage) => {
    if (!confirm(`Usunąć kartkę „${page.title || "bez tytułu"}”? Tej operacji nie można cofnąć.`)) return;
    updateData((d) => ({ ...d, notebook: { pages: d.notebook.pages.filter((p) => p.id !== page.id) } }));
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
            <li key={p.id} className={`flex items-stretch ${selected?.id === p.id ? "border-l-2 border-red bg-paper" : "border-l-2 border-transparent"}`}>
              <button
                type="button"
                className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                aria-current={selected?.id === p.id ? "true" : undefined}
                onClick={() => setSelectedId(p.id)}
              >
                <span className="block truncate">{p.title || "Bez tytułu"}</span>
                <span className="block text-xs text-steel">
                  {new Date(p.updatedAt).toLocaleString("pl-PL")}
                </span>
              </button>
              <div className="flex flex-col border-l border-line">
                <button type="button" className="px-2 text-xs text-steel hover:text-ink disabled:opacity-30" disabled={i === 0} aria-label="Przenieś wyżej" onClick={() => move(p.id, -1)}>
                  ▲
                </button>
                <button type="button" className="px-2 text-xs text-steel hover:text-ink disabled:opacity-30" disabled={i === pages.length - 1} aria-label="Przenieś niżej" onClick={() => move(p.id, 1)}>
                  ▼
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-line p-2">
          <button type="button" className="btn btn-primary w-full justify-center" onClick={create}>
            + Nowa kartka
          </button>
        </div>
      </aside>

      {selected ? (
        <NoteEditor key={selected.id} page={selected} onDelete={() => remove(selected)} />
      ) : (
        <div className="panel flex min-h-80 items-center justify-center p-6 text-center text-steel">
          <div>
            <p>Notatnik jest pusty.</p>
            <p className="mt-1 text-sm">Utwórz pierwszą kartkę, aby zapisywać własne notatki poza tekstem instrukcji.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteEditor({ page, onDelete }: { page: NotePage; onDelete: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [status, setStatus] = useState<"saved" | "pending">("saved");
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
    <section className="panel flex min-h-[28rem] flex-col">
      <div className="silver-bar flex flex-wrap items-center gap-2 px-3 py-2">
        <input
          className="field min-w-0 flex-1 border-transparent bg-transparent text-lg font-semibold focus:bg-white"
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
      <textarea
        className="min-h-96 w-full flex-1 resize-y bg-[linear-gradient(transparent_calc(1.75rem-1px),var(--color-line)_1.75rem)] bg-size-[100%_1.75rem] bg-local px-4 py-[0.4rem] text-base leading-7 outline-none"
        value={body}
        aria-label="Treść notatki"
        placeholder="Pisz tutaj…"
        onChange={(e) => {
          setBody(e.target.value);
          schedule({ title, body: e.target.value });
        }}
      />
      <p className="border-t border-line px-3 py-1.5 text-xs text-steel">
        Notatki zapisują się automatycznie w tej przeglądarce. Znaki: {body.length}
      </p>
    </section>
  );
}
