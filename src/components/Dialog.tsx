"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

/**
 * In-app replacement for `window.confirm` / `window.alert`: a centred modal
 * (`<dialog>` opened with `showModal()`) over a slightly blurred backdrop.
 * `DialogHost` is mounted once in the root layout; components call
 * `confirmDialog()` / `alertDialog()` and await the user's answer.
 */

export interface DialogOptions {
  title: string;
  message?: ReactNode;
  /** Label of the main button (default "OK"). */
  confirmLabel?: string;
  /** Label of the secondary button (default "Anuluj"); not shown by alerts. */
  cancelLabel?: string;
  /** Destructive action: focus starts on "Anuluj" instead of the main button. */
  danger?: boolean;
}

interface Request extends DialogOptions {
  id: number;
  kind: "confirm" | "alert";
  resolve: (ok: boolean) => void;
}

let queue: Request[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function open(kind: Request["kind"], options: DialogOptions) {
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { ...options, kind, id: nextId++, resolve }];
    emit();
  });
}

/** Asks a yes/no question; resolves `true` when the user confirms. */
export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return open("confirm", options);
}

/** Shows a message with a single "OK" button. */
export async function alertDialog(options: DialogOptions): Promise<void> {
  await open("alert", options);
}

function settle(id: number, ok: boolean) {
  const req = queue.find((r) => r.id === id);
  if (!req) return;
  queue = queue.filter((r) => r.id !== id);
  emit();
  req.resolve(ok);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => queue[0] ?? null;
const getServerSnapshot = () => null;

export function DialogHost() {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return current ? <ModalDialog key={current.id} request={current} /> : null;
}

function ModalDialog({ request }: { request: Request }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const isAlert = request.kind === "alert";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    (request.danger && !isAlert ? cancelRef : confirmRef).current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [request, isAlert]);

  const titleId = `dialog-title-${request.id}`;
  return (
    <dialog
      ref={ref}
      className="app-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Escape key: treat as "Anuluj".
        e.preventDefault();
        settle(request.id, isAlert);
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) settle(request.id, isAlert);
      }}
    >
      <div className="app-dialog-body">
        <h2 id={titleId} className="panel-title text-sm">
          {request.title}
        </h2>
        {request.message && (
          <div className="px-5 py-4 text-sm leading-relaxed text-ink">
            {request.message}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper px-5 py-3">
          {!isAlert && (
            <button
              ref={cancelRef}
              type="button"
              className="btn min-w-24 justify-center"
              onClick={() => settle(request.id, false)}
            >
              {request.cancelLabel ?? "Anuluj"}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-primary min-w-24 justify-center"
            onClick={() => settle(request.id, true)}
          >
            {request.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
