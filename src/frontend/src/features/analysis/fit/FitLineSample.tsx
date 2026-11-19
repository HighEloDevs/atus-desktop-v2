/**
 * @module
 * Short sample of a fit curve, used wherever several fits of a dataset are listed.
 */

import { chartLinePatterns } from "@/components/chart/useChartSettings";
import type { LinePattern } from "./dataset-fits";

/**
 * Draws a short line with the colour and pattern of a fit, so the list, the results and the
 * comparison identify a fit the same way the chart draws it.
 * @param props - Colour, line pattern and optional width in pixels.
 * @returns A decorative SVG (hidden from assistive technology).
 */
export function FitLineSample({
  color,
  pattern,
  width = 22,
}: {
  color: string;
  pattern: LinePattern;
  width?: number;
}) {
  return (
    <svg
      width={width}
      height="10"
      viewBox={`0 0 ${width} 10`}
      aria-hidden="true"
      className="shrink-0"
      data-pattern={pattern}
    >
      <line
        x1="1"
        x2={width - 1}
        y1="5"
        y2="5"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray={chartLinePatterns[pattern]}
      />
    </svg>
  );
}
