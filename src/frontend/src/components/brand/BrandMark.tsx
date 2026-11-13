/**
 * @module
 * The ATUS brand mark: four graphite corners around a coral dot.
 */

/**
 * Renders the brand mark. The corners use the current text colour; the dot is always coral.
 * @param props - Optional size in pixels (default 26).
 * @returns The decorative SVG, hidden from assistive technology.
 */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      <g fill="currentColor">
        <path d="M9 9H42V23H23V42H9Z" />
        <path d="M58 9H91V42H77V23H58Z" />
        <path d="M9 58H23V77H42V91H9Z" />
        <path d="M77 58H91V91H58V77H77Z" />
      </g>
      <circle cx="50" cy="50" r="11" fill="#F25A3C" />
    </svg>
  );
}
