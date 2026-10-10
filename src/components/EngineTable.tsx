"use client";

import { useState } from "react";
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
}: {
  carId: string;
  block: TableBlock;
  engines: CarSpec[];
  /** Technical cards link to source blocks and must not repeat their ids on one page. */
  anchorId?: string | null;
}) {
  const engine = useCarEngine(carId);
  const { settings } = useAppData();
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const [expanded, setExpanded] = useState(false);
  const selected = engineTableSelection(block, engine, engines);
  const filtered =
    selected.rows.length < block.rows.length ||
    selected.columns.length <
      Math.max(0, ...block.rows.map((row) => row.length));
  const showAll =
    expanded || (hydrated ? settings.showUnavailable : hint.showUnavailable);
  const cell = (text: string, c: number, header: boolean) => {
    const hidden = !showAll && !selected.columns.includes(c);
    return header ? (
      <th key={c} hidden={hidden} scope="col">
        {polishTypography(text)}
      </th>
    ) : (
      <td key={c} hidden={hidden}>
        {polishTypography(text)}
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
        hidden={!showAll && selected.rows.length === 0}
      >
        <table className="w-full text-sm">
          {block.header && block.rows.length > 0 && (
            <thead>
              <tr>{block.rows[0].map((text, c) => cell(text, c, true))}</tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row, r) =>
              block.header && r === 0 ? null : (
                <tr key={r} hidden={!showAll && !selected.rows.includes(r)}>
                  {row.map((text, c) => cell(text, c, false))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
