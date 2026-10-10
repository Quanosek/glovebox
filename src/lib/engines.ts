import type { TableBlock } from "@/content/types";
import {
  FUEL_LABEL,
  stripDiacritics,
  kwToHp,
  type CarSpec,
  type FuelKind,
} from "./catalog";
import { suggestFromSpec, type VehicleProfile } from "@/config/vehicle";
import { formatDecimal } from "@/lib/files";

const normal = (value: string) =>
  stripDiacritics(value).toLowerCase().replace(/\s+/g, " ").trim();
const number = (value: string) => {
  const match = /^\s*(\d+(?:[.,]\d+)?)(?:\s|$)/.exec(value);
  return match ? Number(match[1].replace(",", ".")) : null;
};
const codeTokens = (value: string) =>
  value
    .toUpperCase()
    .split(/[^A-Z0-9-]+/)
    .filter(Boolean);

export const containsEngineCode = (value: string, codes: readonly string[]) =>
  codeTokens(value).some((code) => codes.includes(code));

const FUEL_ORDER: FuelKind[] = [
  "petrol",
  "diesel",
  "lpg",
  "cng",
  "e85",
  "hybrid-petrol",
  "hybrid-diesel",
  "plugin-petrol",
  "plugin-diesel",
  "electric",
  "hydrogen",
  "other",
];
const roundedCapacity = (engine: CarSpec) =>
  engine.engineCm3 === null
    ? null
    : Math.max(100, Math.round(engine.engineCm3 / 100) * 100);
export const engineChoiceKey = (engine: CarSpec) =>
  `${engine.fuel}:${roundedCapacity(engine)}:${engine.powerKw}`;

export function engineChoiceLabel(engine: CarSpec): string {
  const size = engine.engineCm3
    ? `${formatDecimal(engine.engineCm3 / 1000)} l · `
    : "";
  return `${size}${kwToHp(engine.powerKw)} KM (${engine.powerKw.toLocaleString("pl-PL")} kW)`;
}

/** Merge indistinguishable variants without selecting an arbitrary manufacturer code. */
export function engineChoices(engines: CarSpec[]): CarSpec[] {
  const groups = new Map<string, CarSpec[]>();
  for (const engine of engines) {
    const key = engineChoiceKey(engine);
    groups.set(key, [...(groups.get(key) ?? []), engine]);
  }
  return [...groups.values()]
    .map((group) => {
      const codes = [
        ...new Set(group.flatMap((e) => (e.code ? [e.code] : []))),
      ];
      const engine: CarSpec = {
        fuel: group[0].fuel,
        engineCm3: roundedCapacity(group[0]),
        powerKw: group[0].powerKw,
        label: engineChoiceLabel(group[0]),
        ...(codes.length === 1 ? { code: codes[0] } : {}),
      };
      return engine;
    })
    .sort(
      (a, b) =>
        FUEL_ORDER.indexOf(a.fuel) - FUEL_ORDER.indexOf(b.fuel) ||
        (a.engineCm3 ?? Infinity) - (b.engineCm3 ?? Infinity) ||
        a.powerKw - b.powerKw,
    );
}

export function sanitizeEngine(value: unknown): CarSpec | null {
  if (typeof value !== "object" || value === null) return null;
  if (
    !("fuel" in value) ||
    typeof value.fuel !== "string" ||
    !Object.hasOwn(FUEL_LABEL, value.fuel)
  )
    return null;
  if (
    !("engineCm3" in value) ||
    !(
      value.engineCm3 === null ||
      (typeof value.engineCm3 === "number" &&
        Number.isFinite(value.engineCm3) &&
        value.engineCm3 > 0 &&
        value.engineCm3 <= 20000)
    )
  )
    return null;
  if (
    !("powerKw" in value) ||
    typeof value.powerKw !== "number" ||
    !Number.isFinite(value.powerKw) ||
    value.powerKw <= 0 ||
    value.powerKw > 5000
  )
    return null;
  if (
    !("label" in value) ||
    typeof value.label !== "string" ||
    !value.label.trim()
  )
    return null;
  const code =
    "code" in value &&
    typeof value.code === "string" &&
    /^[A-Za-z0-9-]{1,40}$/.test(value.code)
      ? value.code.toUpperCase()
      : undefined;
  return {
    fuel: value.fuel as FuelKind,
    engineCm3: value.engineCm3,
    powerKw: value.powerKw,
    label: value.label.trim().slice(0, 160),
    ...(code ? { code } : {}),
  };
}

/** Read only explicitly labelled engine specifications; join tables split over pages by code. */
export function enginesFromTables(tables: TableBlock[]): CarSpec[] {
  const records = new Map<
    string,
    {
      name?: string;
      cm3?: number;
      kw?: number;
      fuel?: FuelKind;
      conflict?: boolean;
    }
  >();
  for (const table of tables) {
    const codes = table.rows.find((row) =>
      /oznaczenie kodowe.*silnik|kod silnika/i.test(normal(row[0] ?? "")),
    );
    if (!codes) continue;
    const row = (pattern: RegExp) =>
      table.rows.find((r) => pattern.test(normal(r[0] ?? "")));
    const names = row(/oznaczenie handlowe/);
    const capacities = row(/pojemnosc skokowa/);
    const powers = row(/moc.*\[kw\]/);
    const fuels = row(/rodzaj paliwa/);
    for (let c = 1; c < codes.length; c++) {
      const code = codes[c].trim().toUpperCase();
      if (!/^[A-Z0-9-]{1,40}$/.test(code)) continue;
      const record = records.get(code) ?? {};
      if (names?.[c]) record.name = names[c];
      const cm3 = number(capacities?.[c] ?? "");
      const kw = number(powers?.[c] ?? "");
      if (cm3 !== null) {
        if (record.cm3 !== undefined && record.cm3 !== cm3)
          record.conflict = true;
        record.cm3 = cm3;
      }
      if (kw !== null) {
        if (record.kw !== undefined && record.kw !== kw) record.conflict = true;
        record.kw = kw;
      }
      const fuel = normal(fuels?.[c] ?? "");
      let kind: FuelKind | undefined;
      if (/lpg/.test(fuel)) kind = "lpg";
      else if (/cng/.test(fuel)) kind = "cng";
      else if (/e85/.test(fuel)) kind = "e85";
      else if (!/hybryd|elektry/.test(fuel)) {
        if (/olej napedowy|diesel/.test(fuel)) kind = "diesel";
        else if (/benzyna|petrol/.test(fuel)) kind = "petrol";
      }
      if (kind) {
        if (record.fuel && record.fuel !== kind) record.conflict = true;
        record.fuel = kind;
      }
      records.set(code, record);
    }
  }
  const engines: CarSpec[] = [];
  for (const [code, record] of records) {
    if (record.conflict || !record.kw || !record.cm3 || !record.fuel) continue;
    engines.push({
      code,
      engineCm3: record.cm3,
      powerKw: record.kw,
      fuel: record.fuel,
      label: `${record.name ?? code} · ${record.kw} kW · ${code}`,
    });
  }
  return engines;
}

export function matchingEngineCodes(
  engine: CarSpec,
  engines: CarSpec[],
): string[] {
  if (engine.code) return [engine.code.toUpperCase()];
  return engines
    .filter(
      (e) =>
        e.fuel === engine.fuel &&
        Math.abs(e.powerKw - engine.powerKw) < 1 &&
        e.engineCm3 !== null &&
        engine.engineCm3 !== null &&
        Math.abs(e.engineCm3 - engine.engineCm3) <= 75,
    )
    .flatMap((e) => (e.code ? [e.code] : []));
}

export interface EngineTableSelection {
  columns: number[];
  rows: number[];
}

/** Keep original indices so hidden content retains its anchors and can be expanded. */
export function engineTableSelection(
  table: TableBlock,
  engine: CarSpec | null,
  engines: CarSpec[],
): EngineTableSelection {
  const all = {
    columns: Array.from(
      { length: Math.max(0, ...table.rows.map((r) => r.length)) },
      (_, i) => i,
    ),
    rows: table.rows.map((_, i) => i),
  };
  if (!engine) return all;
  const codes = matchingEngineCodes(engine, engines);
  const known = new Set(
    engines.flatMap((e) => (e.code ? [e.code.toUpperCase()] : [])),
  );
  const matches = (cell: string) => containsEngineCode(cell, codes);
  const identifies = (cell: string) =>
    codeTokens(cell).some((c) => known.has(c));
  const codeRow = table.rows.find(
    (row) =>
      /oznaczenie kodowe.*silnik|kod silnika|^silnik$/i.test(
        normal(row[0] ?? ""),
      ) && row.slice(1).some(identifies),
  );
  if (codeRow && codes.length) {
    const columns = all.columns.filter(
      (c) => c === 0 || matches(codeRow[c] ?? ""),
    );
    if (columns.length > 1) return { ...all, columns };
    if (
      codes.some((code) => known.has(code)) &&
      codeRow.slice(1).every(identifies)
    )
      return { ...all, rows: [] };
  }
  const header = table.rows.find((row) =>
    row.some((cell) => normal(cell) === "silnik"),
  );
  const engineColumn =
    header?.findIndex((cell) => normal(cell) === "silnik") ?? -1;
  if (
    engineColumn >= 0 &&
    codes.length &&
    table.rows.some((row) => identifies(row[engineColumn] ?? ""))
  ) {
    const rows = all.rows.filter(
      (r) =>
        !identifies(table.rows[r][engineColumn] ?? "") ||
        matches(table.rows[r][engineColumn] ?? ""),
    );
    if (rows.some((r) => matches(table.rows[r][engineColumn] ?? "")))
      return { ...all, rows };
  }
  const fuelRow = table.rows.find((row) =>
    row.some((cell) =>
      /silniki benzynowe|silniki wysokoprezne/.test(normal(cell)),
    ),
  );
  if (fuelRow && (engine.fuel === "petrol" || engine.fuel === "diesel")) {
    const columns = all.columns.filter((c) => {
      const cell = normal(fuelRow[c] ?? "");
      if (!/silniki benzynowe|silniki wysokoprezne/.test(cell)) return true;
      return engine.fuel === "diesel"
        ? /wysokoprezne/.test(cell)
        : /benzynowe/.test(cell);
    });
    if (columns.length > 1) return { ...all, columns };
  }
  return all;
}

/** Engine changes refresh derived suggestions; explicit owner has/no choices win. */
export function vehicleProfileWithEngine(
  profile: VehicleProfile,
  engine: CarSpec | null | undefined,
): VehicleProfile {
  return {
    ...suggestFromSpec(engine ?? undefined),
    ...Object.fromEntries(
      Object.entries(profile).filter(
        ([, state]) => state.certainty !== "probable",
      ),
    ),
  };
}
