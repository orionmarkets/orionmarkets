/** The ORIONMARKETS mark: two signal-lime bars and one edge-blue bar, traced from the logo file. */
export function OrionMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="190 320 1600 1370"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M213 1668 466 958 815 788 551 1573Z" fill="#b0e135" />
      <path d="M642 1560 927 737 1276 571 978 1466Z" fill="#b0e135" />
      <path d="M1087 1449 1404 510 1766 337 1442 1339Z" fill="#4178ff" />
    </svg>
  );
}
