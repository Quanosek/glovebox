import type { CarSpec } from "@/lib/catalog";
import { FUEL_LABEL, stripDiacritics } from "@/lib/catalog";
import {
  containsEngineCode,
  engineTableSelection,
  matchingEngineCodes,
  engineChoiceLabel,
} from "@/lib/engines";
import type { TableFact, TechCard } from "@/lib/overview";

export interface DriverFact extends TableFact {
  href?: string;
}
const normal = (text: string) => stripDiacritics(text).toLowerCase();

/** Overview values are source-backed, not estimates or arbitrary early table cells. */
export function driverFacts(
  cards: TechCard[],
  engine: CarSpec | null,
  engines: CarSpec[],
): DriverFact[] {
  const found = new Map<number, DriverFact[]>();
  const add = (fact: TableFact, context: string, href: string) => {
    if (!/\d/.test(fact.value)) return;
    const label = normal(fact.label);
    const combined = normal(`${context} ${fact.label}`);
    let rank: number;
    let display: string;
    if (/zbiornik paliwa|pojemnosc.*(?:baku|zbiornika paliwa)/.test(combined)) {
      if (/adblue|olej silnikowy/.test(combined)) return;
      rank = 0;
      display = "Zbiornik paliwa";
    } else if (
      engine &&
      /spalanie|zuzycie paliwa/.test(combined) &&
      /sredni|mieszan|l\/100/.test(label)
    ) {
      rank = 1;
      display = "Zużycie paliwa według instrukcji";
    } else if (engine && /moment obrotowy/.test(label)) {
      rank = 2;
      display = "Moment obrotowy";
    } else if (/srednica zawracania/.test(label)) {
      rank = 3;
      display = "Średnica zawracania";
    } else if (/pojemnosc.*bagaznika/.test(label)) {
      rank = 4;
      display = "Pojemność bagażnika";
    } else return;
    const unit = /\[([^\]]+)\]/.exec(fact.label)?.[1];
    const unitPattern = unit
      ? new RegExp(
          `(?:^|\\s|\\d)${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s|[,.])`,
          "i",
        )
      : null;
    let value =
      unit && !unitPattern?.test(fact.value)
        ? `${fact.value} ${unit}`
        : fact.value;
    const alternatives =
      /^(\d+(?:[.,]\d+)?)\s*(\([^)]*\))\s+(\d+(?:[.,]\d+)?)$/.exec(fact.value);
    if (unit && alternatives)
      value = `${alternatives[1]} ${unit} ${alternatives[2]} / ${alternatives[3]} ${unit}`;
    const list = found.get(rank) ?? [];
    if (!list.some((f) => f.value === value))
      list.push({ label: display, value, href });
    found.set(rank, list);
  };
  for (const card of cards) {
    for (const table of card.tables) {
      const context = `${card.section} ${table.title ?? ""}`;
      if (table.kind === "facts") {
        for (const fact of table.facts) add(fact, context, table.href);
      } else if (engine) {
        const selection = engineTableSelection(
          {
            type: "table",
            id: table.id,
            header: table.header,
            rows: table.rows,
          },
          engine,
          engines,
        );
        // Ambiguous engine matrices remain intact in the reader, but are not presented as this car's values.
        if (
          selection.columns.length !== 2 ||
          (table.rows.every((row) => row.length <= 2) &&
            !table.rows.some((row) =>
              containsEngineCode(
                row[1] ?? "",
                matchingEngineCodes(engine, engines),
              ),
            ))
        )
          continue;
        for (const r of selection.rows) {
          const row = table.rows[r];
          if (table.header && r === 0) continue;
          const value = row[selection.columns[1]];
          if (row[0] && value)
            add({ label: row[0], value }, context, table.href);
        }
      }
    }
  }
  const facts: DriverFact[] = engine
    ? [
        { label: "Wybrany silnik", value: engineChoiceLabel(engine) },
        { label: "Paliwo", value: FUEL_LABEL[engine.fuel] },
      ]
    : [];
  for (const [, list] of [...found].sort(([a], [b]) => a - b)) {
    if (facts.length >= 4) break;
    // Keep alternatives and source qualifications rather than guessing which applies.
    facts.push({ ...list[0], value: list.map((f) => f.value).join(" / ") });
  }
  return facts;
}
