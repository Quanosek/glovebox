"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * In-app replacement for `window.confirm` / `window.alert` / `window.prompt`:
 * a centred modal
 * (`<dialog>` opened with `showModal()`) over a slightly blurred backdrop.
 * `DialogHost` is mounted once in the root layout; components call
 * `confirmDialog()` / `alertDialog()` / `promptDialog()` and await the answer.
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

export interface PromptOptions extends DialogOptions {
  /** Label above the text field. */
  label: string;
  placeholder?: string;
  defaultValue?: string;
  maxLength?: number;
}

interface Request extends Partial<PromptOptions> {
  title: string;
  id: number;
  kind: "confirm" | "alert" | "prompt";
  /** `ok` = main button; `value` = text field contents (prompts only). */
  resolve: (ok: boolean, value: string) => void;
}

let queue: Request[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function open(kind: Request["kind"], options: Partial<PromptOptions>) {
  return new Promise<{ ok: boolean; value: string }>((resolve) => {
    queue = [
      ...queue,
      {
        title: "",
        ...options,
        kind,
        id: nextId++,
        resolve: (ok, value) => resolve({ ok, value }),
      },
    ];
    emit();
  });
}

/** Asks a yes/no question; resolves `true` when the user confirms. */
export async function confirmDialog(options: DialogOptions): Promise<boolean> {
  return (await open("confirm", options)).ok;
}

/** Shows a message with a single "OK" button. */
export async function alertDialog(options: DialogOptions): Promise<void> {
  await open("alert", options);
}

/** Asks for one line of text; resolves `null` when the user cancels. */
export async function promptDialog(
  options: PromptOptions,
): Promise<string | null> {
  const { ok, value } = await open("prompt", options);
  return ok ? value : null;
}

function settle(id: number, ok: boolean, value = "") {
  const req = queue.find((r) => r.id === id);
  if (!req) return;
  queue = queue.filter((r) => r.id !== id);
  emit();
  req.resolve(ok, value);
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
  const inputRef = useRef<HTMLInputElement>(null);
  const isAlert = request.kind === "alert";
  const isPrompt = request.kind === "prompt";
  const [value, setValue] = useState(request.defaultValue ?? "");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    if (isPrompt) inputRef.current?.select();
    else (request.danger && !isAlert ? cancelRef : confirmRef).current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [request, isAlert, isPrompt]);

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
      <form
        className="app-dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          settle(request.id, true, value);
        }}
      >
        <h2 id={titleId} className="panel-title">
          {request.title}
        </h2>
        {request.message && (
          <div className="px-5 py-4 text-sm leading-relaxed text-ink">
            {request.message}
          </div>
        )}
        {isPrompt && (
          <label
            className={`block px-5 pb-5 text-sm text-graphite ${request.message ? "" : "pt-4"}`}
          >
            <span className="mb-1.5 block">{request.label}</span>
            <input
              ref={inputRef}
              className="field"
              placeholder={request.placeholder}
              maxLength={request.maxLength}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
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
            type="submit"
            className="btn btn-primary min-w-24 justify-center"
          >
            {request.confirmLabel ?? "OK"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
