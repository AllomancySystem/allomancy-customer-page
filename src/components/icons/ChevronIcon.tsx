/**
 * Disclosure chevron for the single-store "Credit details" toggle: points down
 * when `open`, right when collapsed. Inherits color via `currentColor`;
 * decorative (the button carries a visible "Credit details" label), so
 * `aria-hidden`. Vendored inline SVG so the template stays dependency-free.
 */
export function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
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
      {open ? <path d="m6 9 6 6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}
