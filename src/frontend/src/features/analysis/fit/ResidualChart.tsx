/**
 * @module
 * Stem plot of the residual of each fitted point.
 */

import { scaleLinear } from "d3";
import { formatSignificant, residualAxis } from "./result-format";

const WIDTH = 620;
const HEIGHT = 180;
const MARGIN = { top: 16, right: 14, bottom: 32, left: 62 };

/**
 * Draws residuals against x with a zero line and a symmetric, rounded y axis.
 * @param props - Residuals to plot and the series colour.
 * @returns An SVG with an accessible label, or null when there are no residuals.
 */
export function ResidualChart({
  residuals,
  color,
}: {
  residuals: { x: number; residual: number }[];
  color: string;
}) {
  if (residuals.length === 0) return null;
  const xs = residuals.map((r) => r.x);
  const x = scaleLinear()
    .domain([Math.min(...xs), Math.max(...xs)])
    .nice()
    .range([MARGIN.left, WIDTH - MARGIN.right]);
  const { limit, ticks } = residualAxis(residuals.map((r) => r.residual));
  const y = scaleLinear()
    .domain([-limit, limit])
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  const signed = (value: number) =>
    value === 0 ? "0" : `${value > 0 ? "+" : "−"}${formatSignificant(Math.abs(value), 2)}`;
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Resíduos de cada ponto em função de x"
      className="block h-auto w-full"
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke={tick === 0 ? "#66716e" : "#d8ded7"}
            strokeDasharray={tick === 0 ? undefined : "3 4"}
          />
          <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#66716e">
            {signed(tick)}
          </text>
        </g>
      ))}
      {x.ticks(6).map((tick) => (
        <text
          key={tick}
          x={x(tick)}
          y={HEIGHT - 12}
          textAnchor="middle"
          fontSize="11"
          fill="#66716e"
        >
          {formatSignificant(tick, 3)}
        </text>
      ))}
      <text x={MARGIN.left} y={10} fontSize="11" fill="#66716e">
        resíduo
      </text>
      <text x={WIDTH - MARGIN.right} y={HEIGHT - 1} textAnchor="end" fontSize="11" fill="#66716e">
        x
      </text>
      {residuals.map((r, i) => (
        <g key={i}>
          <line
            x1={x(r.x)}
            x2={x(r.x)}
            y1={y(0)}
            y2={y(r.residual)}
            stroke={color}
            strokeWidth="2"
            opacity="0.55"
          />
          <circle cx={x(r.x)} cy={y(r.residual)} r="4" fill={color} />
        </g>
      ))}
    </svg>
  );
}
