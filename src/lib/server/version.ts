export function versionAtLeast(
  actual: string | null,
  required: string,
): boolean {
  const parts = actual
    ?.match(/\d+(?:\.\d+)*/)?.[0]
    .split(".")
    .map(Number);
  const minimum = required.split(".").map(Number);
  if (!parts) return false;
  for (let i = 0; i < minimum.length; i++) {
    const left = parts[i] ?? 0;
    if (left !== minimum[i]) return left > minimum[i];
  }
  return true;
}
