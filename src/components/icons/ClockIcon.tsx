/**
 * Clock glyph for the "Expires soon" urgency chip. Inherits its color from the
 * surrounding text via `currentColor`; decorative (always paired with visible
 * text per FD5), so `aria-hidden`. Sizing is left to the caller / the Badge's
 * `[&>svg]` rule. Vendored inline SVG so the template stays dependency-free.
 */
export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
