import { plural } from "@/lib/typography";
import { SOON_DAYS } from "@/lib/reminders";

/** "termin minął" / "dzisiaj" / "za N dni" for a dated reminder. */
export function DueBadge({ days }: { days: number }) {
  return (
    <span
      className={`badge shrink-0 ${days < 0 ? "badge-red" : days <= SOON_DAYS ? "badge-dark" : ""}`}
    >
      {dueText(days)}
    </span>
  );
}

export function dueText(days: number): string {
  if (days < 0) {
    const ago = -days;
    return `termin minął ${ago} ${plural(ago, "dzień", "dni", "dni")} temu`;
  }
  if (days === 0) return "dzisiaj";
  if (days === 1) return "jutro";
  return `za ${days} ${plural(days, "dzień", "dni", "dni")}`;
}
