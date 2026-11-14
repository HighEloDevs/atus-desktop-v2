/**
 * @module
 * SVG pieces of a chart axis shared by the main chart and the residuals panel:
 * grid lines, tick marks and tick labels.
 */

import {
  AXIS_COLORS,
  formatAxisTick,
  TICK_LENGTH,
  tickSpan,
  yLabelGap,
  type AxisSettings,
} from "./axisSettings";

/**
 * Grid lines of one axis: vertical lines for X, horizontal lines for Y.
 * @param props - Axis, tick values, scale, plot size, and axis settings.
 * @returns The rendered SVG group.
 */
export function AxisGrid({
  axis,
  majors,
  minors,
  scale,
  width,
  height,
  settings,
}: {
  axis: "x" | "y";
  majors: number[];
  minors: number[];
  scale: (value: number) => number;
  width: number;
  height: number;
  settings: AxisSettings;
}) {
  const line = (value: number, stroke: string, key: string) =>
    axis === "x" ? (
      <line key={key} x1={scale(value)} x2={scale(value)} y2={height} stroke={stroke} />
    ) : (
      <line key={key} y1={scale(value)} y2={scale(value)} x2={width} stroke={stroke} />
    );
  return (
    <g>
      {settings.minorGrid &&
        minors.map((value) => line(value, AXIS_COLORS.minorGrid, `minor-${value}`))}
      {settings.grid && majors.map((value) => line(value, AXIS_COLORS.grid, `major-${value}`))}
    </g>
  );
}

/**
 * Tick marks along an axis line, pointing out of, into, or across the plot.
 * @param props - Axis, tick values, scale, the axis line position, and axis settings.
 * @returns The rendered SVG group.
 */
export function TickMarks({
  axis,
  majors,
  minors,
  scale,
  at,
  settings,
}: {
  axis: "x" | "y";
  majors: number[];
  minors: number[];
  scale: (value: number) => number;
  at: number;
  settings: AxisSettings;
}) {
  const mark = (value: number, length: number, key: string) => {
    const [from, to] = tickSpan(settings.tickDirection, length);
    const p = scale(value);
    return axis === "x" ? (
      <line key={key} x1={p} x2={p} y1={at + from} y2={at + to} stroke={AXIS_COLORS.tick} />
    ) : (
      <line key={key} y1={p} y2={p} x1={at - to} x2={at - from} stroke={AXIS_COLORS.tick} />
    );
  };
  return (
    <g data-testid={`${axis}-tick-marks`}>
      {minors.map((value) => mark(value, TICK_LENGTH.minor, `minor-${value}`))}
      {majors.map((value) => mark(value, TICK_LENGTH.major, `major-${value}`))}
    </g>
  );
}

/**
 * X tick labels on the bottom border, optionally rotated.
 * @param props - Tick values, scale, the bottom border position, axis settings, and
 * whether the axis is highlighted.
 * @returns The rendered SVG group.
 */
export function XTickLabels({
  ticks,
  scale,
  bottom,
  settings,
  highlighted,
}: {
  ticks: number[];
  scale: (value: number) => number;
  bottom: number;
  settings: AxisSettings;
  highlighted?: boolean;
}) {
  const fill = highlighted ? AXIS_COLORS.labelHighlight : AXIS_COLORS.label;
  const { fontSize, rotation } = settings;
  const pivot = bottom + 8;
  return (
    <g data-testid="x-tick-labels">
      {ticks.map((value) => {
        const p = scale(value);
        return rotation === 0 ? (
          <text
            key={value}
            x={p}
            y={bottom + 11 + fontSize / 2}
            textAnchor="middle"
            fontSize={fontSize}
            fill={fill}
          >
            {formatAxisTick(value, settings)}
          </text>
        ) : (
          <text
            key={value}
            x={p}
            y={pivot + fontSize * 0.35}
            textAnchor="end"
            fontSize={fontSize}
            fill={fill}
            transform={`rotate(${-rotation} ${p} ${pivot})`}
          >
            {formatAxisTick(value, settings)}
          </text>
        );
      })}
    </g>
  );
}

/**
 * Y tick labels on the left border, horizontal or rotated (90° reads bottom to top).
 * @param props - Tick values, scale, axis settings, whether the axis is highlighted, an
 * optional formatter (the residual axis shows signs), and the test id of the group.
 * @returns The rendered SVG group.
 */
export function YTickLabels({
  ticks,
  scale,
  settings,
  highlighted,
  format = formatAxisTick,
  testId = "y-tick-labels",
}: {
  ticks: number[];
  scale: (value: number) => number;
  settings: AxisSettings;
  highlighted?: boolean;
  format?: (value: number, settings: AxisSettings) => string;
  testId?: string;
}) {
  const fill = highlighted ? AXIS_COLORS.labelHighlight : AXIS_COLORS.label;
  const { fontSize, rotation } = settings;
  const x = -yLabelGap(settings);
  return (
    <g data-testid={testId}>
      {ticks.map((value) => {
        const p = scale(value);
        const text = format(value, settings);
        if (rotation === 90)
          return (
            <text
              key={value}
              x={x}
              y={p}
              textAnchor="middle"
              fontSize={fontSize}
              fill={fill}
              transform={`rotate(-90 ${x} ${p})`}
            >
              {text}
            </text>
          );
        return (
          <text
            key={value}
            x={x}
            y={p}
            dy=".32em"
            textAnchor="end"
            fontSize={fontSize}
            fill={fill}
            transform={rotation === 45 ? `rotate(-45 ${x} ${p})` : undefined}
          >
            {text}
          </text>
        );
      })}
    </g>
  );
}
