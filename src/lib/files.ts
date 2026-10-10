/** Helpers for manual files picked in the add-car wizard (client and server). */

/** Readable title of a manual from its file name ("instrukcja_cascada.pdf"). */
export function documentTitle(fileName: string): string {
  return fileName
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** File size in Polish notation: "1,5 MB", "840 kB". */
export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${formatDecimal(bytes / 1024 / 1024)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} kB`;
}

/** A number with a decimal comma: 1.6 -> "1,6". */
export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}
