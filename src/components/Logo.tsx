/** Generic open-book mark used when no vehicle logo is selected. */
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
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 14.5c9.5-2.2 17.2-.8 24 4.2 6.8-5 14.5-6.4 24-4.2v35c-9.5-2.2-17.2-.8-24 4.2-6.8-5-14.5-6.4-24-4.2v-35Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 19v34M14 23c5-.8 9.5-.3 13 1.2M14 31c5-.8 9.5-.3 13 1.2m23-9.2c-5-.8-9.5-.3-13 1.2m13 6.8c-5-.8-9.5-.3-13 1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
