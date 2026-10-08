const POLISH: Record<string, string> = { ł: "l", Ł: "l" };

/** Lowercase ASCII slug (Polish diacritics transliterated). */
export function slugify(value: string, maxLength = 60): string {
  return value
    .replace(/[łŁ]/g, (c) => POLISH[c])
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Returns `base`, or `base-2`, `base-3`… when the name is already taken. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Car and book ids: lowercase slug, safe to use as a directory name. */
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function isValidId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}
