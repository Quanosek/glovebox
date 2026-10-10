"use client";

import { useState, type ReactNode } from "react";
import type { TableBlock } from "@/content/types";
import type { CarSpec } from "@/lib/catalog";
import { engineTableSelection } from "@/lib/engines";
import { useAppData, useCarEngine, useHydrated } from "@/lib/storage/hooks";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { polishTypography } from "@/lib/typography";

export function EngineTable({
  carId,
  block,
  engines,
  anchorId = block.id,
  cellNodes,
}: {
  carId: string;
  block: TableBlock;
  engines: CarSpec[];
  /** Technical cards link to source blocks and must not repeat their ids on one page. */
  anchorId?: string | null;
  /** Rendered rich cells (pictograms, references), aligned with `block.rows`. */
  cellNodes?: ReactNode[][];
}) {
  const engine = useCarEngine(carId);
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const [expanded, setExpanded] = useState(false);
  const selected = engineTableSelection(block, engine, engines);
  const filtered =
    !block.spans &&
    (selected.rows.length < block.rows.length ||
      selected.columns.length <
        Math.max(0, ...block.rows.map((row) => row.length)));
  const showAll =
    expanded || (hydrated ? settings.showUnavailable : hint.showUnavailable);
  const spans = block.spans;
  const headerRows = block.header
    ? Math.min(block.headerRows ?? 1, block.rows.length)
    : 0;
  const cell = (text: string, r: number, c: number, header: boolean) => {
    const span = spans?.[r]?.[c];
    // A position covered by a merged cell renders nothing.
    if (spans && span === null) return null;
    const hidden = !spans && !showAll && !selected.columns.includes(c);
    const content = cellNodes?.[r]?.[c] ?? polishTypography(text);
    const props = {
      hidden,
      colSpan: span && span[0] > 1 ? span[0] : undefined,
      rowSpan: span && span[1] > 1 ? span[1] : undefined,
    };
    return header ? (
      <th key={c} scope="col" {...props}>
        {content}
      </th>
    ) : (
      <td key={c} {...props}>
        {content}
      </td>
    );
  };
  return (
    <>
      {filtered && (
        <div
          data-anchor-ignore
          className="my-2 flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <span className="text-graphite">
            {selected.rows.length
              ? "Dane dla Twojego silnika"
              : "Dane dla innych silników"}
          </span>
          <button
            type="button"
            className="btn py-1"
            aria-expanded={showAll}
            disabled={
              hydrated ? settings.showUnavailable : hint.showUnavailable
            }
            onClick={() => setExpanded((value) => !value)}
          >
            {showAll ? "Pokaż tylko mój silnik" : "Pokaż wszystkie silniki"}
          </button>
        </div>
      )}
      <div
        id={anchorId ?? undefined}
        className="overflow-x-auto"
        hidden={!block.spans && !showAll && selected.rows.length === 0}
      >
        <table className="w-full text-sm">
          {headerRows > 0 && (
            <thead>
              {block.rows.slice(0, headerRows).map((row, r) => (
                <tr key={r}>{row.map((text, c) => cell(text, r, c, true))}</tr>
              ))}
            </thead>
          )}
          <tbody>
            {block.rows.map((row, r) =>
              r < headerRows ? null : (
                <tr
                  key={r}
                  hidden={
                    !block.spans && !showAll && !selected.rows.includes(r)
                  }
                >
                  {row.map((text, c) => cell(text, r, c, false))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
