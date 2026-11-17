/**
 * @module
 * Small static plot of the guide page: points with error bars and fitted curves.
 *
 * The guide only needs a fixed illustration, so this draws plain SVG instead of the
 * interactive analysis chart. Curves are evaluated from the fit equations with the same
 * interpreter the analysis uses.
 */

import { niceTicks, sampleFit } from "./guide-plot";
import type { GuideSeries } from "./lesson";

const WIDTH = 640;
const HEIGHT = 300;
const PAD = { left: 52, right: 16, top: 16, bottom: 42 };
const COLORS = { data: "#364cff", muted: "#9aa3a0" } as const;

const decimal = (value: number) => String(value).replace(".", ",");

/**
 * Plot of one or more series with their fits, with a legend and axis titles.
 * @param props.series - Series to draw, the last one on top.
 * @param props.xLabel - Horizontal axis title.
 * @param props.yLabel - Vertical axis title.
 * @param props.label - Accessible description of the plot.
 */
export function GuidePlot({
  series,
  xLabel,
  yLabel,
  label,
}: {
  series: GuideSeries[];
  xLabel: string;
  yLabel: string;
  label: string;
}) {
  const points = series.flatMap((s) => s.rows);
  const xTicks = niceTicks(Math.max(...points.map(([x]) => x)));
  const yTicks = niceTicks(Math.max(...points.map(([, y, sy]) => y + sy)));
  const xMax = xTicks.at(-1)!;
  const yMax = yTicks.at(-1)!;
  const sx = (x: number) => PAD.left + (x / xMax) * (WIDTH - PAD.left - PAD.right);
  const sy = (y: number) => HEIGHT - PAD.bottom - (y / yMax) * (HEIGHT - PAD.top - PAD.bottom);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
      className="h-auto w-full font-sans text-[11px]"
    >
      <rect width={WIDTH} height={HEIGHT} fill="#fff" />
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={sy(t)} y2={sy(t)} stroke="#eceee9" />
          <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" fill="#66716e">
            {decimal(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text
          key={`x${t}`}
          x={sx(t)}
          y={HEIGHT - PAD.bottom + 16}
          textAnchor="middle"
          fill="#66716e"
        >
          {decimal(t)}
        </text>
      ))}
      <path
        d={`M${PAD.left} ${PAD.top}V${HEIGHT - PAD.bottom}H${WIDTH - PAD.right}`}
        fill="none"
        stroke="#20272c"
      />
      <text
        x={(PAD.left + WIDTH - PAD.right) / 2}
        y={HEIGHT - 6}
        textAnchor="middle"
        fill="#20272c"
      >
        {xLabel}
      </text>
      <text
        transform={`translate(14 ${(PAD.top + HEIGHT - PAD.bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
        fill="#20272c"
      >
        {yLabel}
      </text>
      {series.map((s) => {
        const color = COLORS[s.tone];
        const curve = sampleFit(s, 0, Math.max(...s.rows.map(([x]) => x)));
        return (
          <g key={s.label} data-series={s.label}>
            {curve.length > 0 && (
              <polyline
                points={curve.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
              />
            )}
            {s.rows.map(([x, y, e]) => (
              <g key={x}>
                <line x1={sx(x)} x2={sx(x)} y1={sy(y - e)} y2={sy(y + e)} stroke={color} />
                <circle cx={sx(x)} cy={sy(y)} r={3.2} fill={color} />
              </g>
            ))}
          </g>
        );
      })}
      {series.map((s, i) => (
        <g
          key={`legend-${s.label}`}
          transform={`translate(${PAD.left + 14} ${PAD.top + 10 + i * 16})`}
        >
          <circle r={3.5} fill={COLORS[s.tone]} />
          <text x={9} y={4} fill="#20272c">
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
