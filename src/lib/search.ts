/**
 * Polish-aware normalisation for client-side search: lower case and
 * diacritics removed ("Łożysko" → "lozysko"), so queries work with or
 * without Polish characters.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Returns a short excerpt of `text` around the first matching term. */
export function excerpt(text: string, terms: string[], radius = 90): string {
  const norm = normalizeText(text);
  let pos = -1;
  for (const t of terms) {
    const i = norm.indexOf(normalizeText(t));
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  const flat = (s: string) => s.replace(/\s+/g, " ").trim();
  if (pos < 0) return flat(text.slice(0, radius * 2)) + (text.length > radius * 2 ? "…" : "");
  const start = Math.max(0, pos - radius);
  const end = Math.min(text.length, pos + radius);
  return `${start > 0 ? "…" : ""}${flat(text.slice(start, end))}${end < text.length ? "…" : ""}`;
}
