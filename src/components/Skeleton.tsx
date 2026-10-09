/**
 * Loading placeholder. Without a height class it is exactly one text line of
 * the surrounding font size (it holds a non-breaking space), so a placeholder
 * line takes the same space as the text that replaces it.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`skeleton ${className}`.trim()}>
      {"\u00a0"}
    </span>
  );
}
