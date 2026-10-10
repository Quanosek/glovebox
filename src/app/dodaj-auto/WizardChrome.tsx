import type { CSSProperties, ReactNode } from "react";
import { STEPS, type Step } from "./wizardModel";

/**
 * Step strip in the spirit of the Navi 950 soft keys: square keys on one
 * line, a red track growing with the progress and labels under each key.
 * Phones show the keys only, plus one line naming the current step.
 */
export function WizardSteps({ step }: { step: Step }) {
  const current = STEPS[step - 1];
  return (
    <nav aria-label="Etapy dodawania auta" className="wizard-steps">
      <p className="mb-3 text-sm text-graphite sm:hidden">
        Etap {step} z {STEPS.length}:{" "}
        <strong className="text-ink">{current.label}</strong>
      </p>
      <ol
        className="wizard-track"
        style={
          {
            "--wizard-progress": (step - 1) / (STEPS.length - 1),
          } as CSSProperties
        }
      >
        {STEPS.map((s) => (
          <li
            key={s.n}
            aria-current={step === s.n ? "step" : undefined}
            data-state={step === s.n ? "current" : step > s.n ? "done" : "todo"}
            className="wizard-stop"
          >
            <span className="wizard-key" aria-hidden="true">
              {step > s.n ? "✓" : s.n}
            </span>
            <span className="sr-only sm:not-sr-only sm:mt-2 sm:block sm:text-sm">
              <span className="wizard-label block">{s.label}</span>
              <span className="block text-xs text-steel">{s.hint}</span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PanelHeading({
  mark,
  title,
  hint,
}: {
  mark: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="silver-bar flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <span className="wizard-mark" aria-hidden="true">
        {mark}
      </span>
      <h3 className="type-item">{title}</h3>
      {hint && <span className="ml-auto text-xs text-steel">{hint}</span>}
    </div>
  );
}

export function DropIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="h-12 w-12 text-silver"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M12 6h17l9 9v27H12z" />
      <path d="M29 6v9h9" />
      <path d="M25 22v13m-5-5 5 5 5-5" className="text-red" />
    </svg>
  );
}

export function Field({
  label,
  htmlFor,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label
        htmlFor={htmlFor}
        className="mb-1 text-xs font-semibold tracking-[0.08em] text-graphite uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Plain-language status shown above the form when cars cannot be added right
 * now (no connection, another import running, PDF reader not installed …).
 * Technical details are deliberately left to the README.
 */

export function Progress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="mb-1 text-graphite">{label}</p>
      <div
        className="h-2 border border-line bg-paper"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-red transition-[width]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
