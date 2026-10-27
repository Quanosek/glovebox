/** Glovebox app mark (same drawing as src/app/icon.svg), used when no vehicle logo is selected. */
export function Logo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      filter="drop-shadow(0 1px 1px #0003)"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 25.5V12.2c6.6-1.5 12.6-.6 18 3 5.4-3.6 11.4-4.5 18-3v13.3M32 15.2v10.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 27.5h52l-4 25H10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path d="M22 34h20v5H22z" className="fill-red" />
    </svg>
  );
}
