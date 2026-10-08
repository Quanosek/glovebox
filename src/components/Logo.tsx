/** Simplified original drawing of the Opel emblem (same geometry as app/icon.svg). */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="32" r="23.5" fill="none" stroke="currentColor" strokeWidth="4.5" />
      <path d="M6 26.2H42.5L30.5 34.2H58V38.2H21.5L33.5 30.2H6Z" fill="currentColor" />
    </svg>
  );
}
