import type { TextAnchor } from "@/lib/storage/schema";

/**
 * Robust text anchoring, modelled on the W3C Web Annotation
 * TextQuoteSelector (exact + prefix + suffix) combined with a
 * TextPositionSelector (start/end offsets). Operates on plain strings so it
 * is independent from the DOM (see `dom.ts` for the DOM mapping).
 */

export const CONTEXT_LENGTH = 32;

export interface TextRange {
  start: number;
  end: number;
}

export function describe(text: string, start: number, end: number): TextAnchor {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(text.length, Math.max(start, end));
  return {
    exact: text.slice(s, e),
    prefix: text.slice(Math.max(0, s - CONTEXT_LENGTH), s),
    suffix: text.slice(e, e + CONTEXT_LENGTH),
    start: s,
    end: e,
  };
}

/** Finds the anchor in (possibly changed) text. Returns null when lost. */
export function resolve(text: string, anchor: TextAnchor): TextRange | null {
  const { exact, start, end } = anchor;
  if (!exact) return null;
  // 1. Fast path: the text at the stored position is unchanged.
  if (text.slice(start, end) === exact) return { start, end };

  // 2. Exact quote elsewhere: pick the occurrence with the best context.
  const candidates: number[] = [];
  for (let i = text.indexOf(exact); i !== -1; i = text.indexOf(exact, i + 1)) {
    candidates.push(i);
  }
  if (candidates.length) {
    const best = pickBest(text, anchor, candidates, exact.length);
    return { start: best, end: best + exact.length };
  }

  // 3. Whitespace-insensitive match (content regenerated with other spacing).
  return resolveNormalized(text, anchor);
}

function pickBest(text: string, anchor: TextAnchor, positions: number[], length: number): number {
  let best = positions[0];
  let bestScore = -Infinity;
  for (const pos of positions) {
    const prefix = text.slice(Math.max(0, pos - anchor.prefix.length), pos);
    const suffix = text.slice(pos + length, pos + length + anchor.suffix.length);
    const score =
      commonSuffix(prefix, anchor.prefix) +
      commonPrefix(suffix, anchor.suffix) -
      Math.abs(pos - anchor.start) / Math.max(text.length, 1);
    if (score > bestScore) {
      bestScore = score;
      best = pos;
    }
  }
  return best;
}

function resolveNormalized(text: string, anchor: TextAnchor): TextRange | null {
  const { normalized, map } = normalizeWithMap(text);
  const exact = normalizeWithMap(anchor.exact).normalized.trim();
  if (!exact) return null;
  const positions: number[] = [];
  for (let i = normalized.indexOf(exact); i !== -1; i = normalized.indexOf(exact, i + 1)) {
    positions.push(i);
  }
  if (!positions.length) return null;
  const normAnchor: TextAnchor = {
    exact,
    prefix: normalizeWithMap(anchor.prefix).normalized,
    suffix: normalizeWithMap(anchor.suffix).normalized,
    start: map.findIndex((orig) => orig >= anchor.start),
    end: 0,
  };
  const best = pickBest(normalized, normAnchor, positions, exact.length);
  const startOrig = map[best];
  const endOrig = map[best + exact.length - 1] + 1;
  return { start: startOrig, end: endOrig };
}

/** Collapses whitespace runs to one space; `map[i]` = index in original. */
export function normalizeWithMap(text: string): { normalized: string; map: number[] } {
  let normalized = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isSpace = /\s/.test(ch);
    if (isSpace) {
      if (prevSpace) continue;
      normalized += " ";
    } else {
      normalized += ch;
    }
    map.push(i);
    prevSpace = isSpace;
  }
  return { normalized, map };
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function commonSuffix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}
