/**
 * Polish typesetting rules for displayed text (see docs/ui.md → Typography).
 *
 * Polish editorial practice forbids leaving short words at the end of a line
 * ("sieroty") and a lone short word on the last line of a paragraph
 * ("wdowy"). Browsers cannot do this on their own, so ordinary spaces are
 * replaced by non-breaking spaces (U+00A0) where a line break is not allowed.
 * Every replacement keeps the string length unchanged (one space for one
 * space), so text offsets used by highlight anchoring stay valid.
 */

export const NBSP = "\u00a0";

// A word starts after the text start, whitespace or an opening bracket/quote.
const BEFORE_WORD = "(?<=^|[\\s([{„“\"'«‹–—])";

/** One-letter conjunctions and prepositions: a, i, o, u, w, z. */
const SINGLE_LETTER = new RegExp(
  `${BEFORE_WORD}([aiouwzAIOUWZ])[ \\t]+(?=\\S|$)`,
  "gu",
);

/** Abbreviations that must stay with the following word or number. */
const ABBREVIATIONS = new RegExp(
  `${BEFORE_WORD}(np\\.|m\\.in\\.|tzn\\.|tj\\.|tzw\\.|ok\\.|ul\\.|nr|str\\.|s\\.|pkt|godz\\.|wg|ang\\.|poz\\.|rys\\.|tab\\.|zob\\.|por\\.|§)[ \\t]+(?=\\S|$)`,
  "giu",
);

/** Abbreviations that must stay with the preceding word (end of a list). */
const TRAILING_ABBREVIATIONS = /[ \t]+(?=(?:itd|itp|etc|i in)\.)/gu;

/** A number and a short unit or symbol: 125 kW, 5 l, 20 °C, 30 %. */
const NUMBER_UNIT = /(?<=\d)[ \t]+(?=[%‰°]|[\p{L}µ/]{1,4}(?![\p{L}]))/gu;

/** Thousands separated with a space: 1 500, 12 000. */
const DIGIT_GROUP = /(?<=\d)[ \t]+(?=\d{3}(?!\d))/gu;

/** A dash never starts a line; it stays with the preceding word. */
const DASH = /[ \t]+(?=[–—](?:\s|$))/gu;

export interface TypographyOptions {
  /**
   * Binds the last two words of the text, so a paragraph never ends with a
   * single short word on its own line. Use for whole paragraphs only.
   */
  lastWord?: boolean;
}

/** Applies Polish line-breaking rules. Idempotent. */
export function polishTypography(
  text: string,
  options: TypographyOptions = {},
): string {
  if (!text || !/[ \t]/.test(text)) return text;
  let out = text
    .replace(SINGLE_LETTER, `$1${NBSP}`)
    .replace(ABBREVIATIONS, `$1${NBSP}`)
    .replace(TRAILING_ABBREVIATIONS, NBSP)
    .replace(NUMBER_UNIT, NBSP)
    .replace(DIGIT_GROUP, NBSP)
    .replace(DASH, NBSP);
  if (options.lastWord) out = bindLastWord(out);
  return out;
}

/** Last word of a paragraph up to this length is kept with the word before. */
const LAST_WORD_MAX = 10;

function bindLastWord(text: string): string {
  const match = /[ \t]+(\S+)\s*$/u.exec(text);
  if (!match) return text;
  if (match[1].length > LAST_WORD_MAX) return text;
  // Leave at least one ordinary space so a paragraph can still wrap.
  const before = text.slice(0, match.index);
  if (!/[ \t]/.test(before)) return text;
  const spaces = match[0].length - match[0].trimStart().length;
  return before + NBSP.repeat(spaces) + text.slice(match.index + spaces);
}

/** Polish plural form: 1 plik, 2–4 (22–24…) pliki, 0 / 5+ / 12–14 plików. */
export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}
