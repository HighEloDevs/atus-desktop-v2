/**
 * @module
 * Tooltip card shown beside the active chart point.
 */

import { Fragment, useLayoutEffect, useRef } from "react";
import { renderLabelHtml } from "./labelMarkup";
import {
  formatTooltipValue,
  placeTooltip,
  type TooltipLabels,
  type TooltipPoint,
} from "./tooltipModel";

/** Maximum number of coincident points detailed before the rest is only counted. */
export const MAX_TOOLTIP_POINTS = 3;

type ChartTooltipProps = {
  /** Points to show, with the active one first. Must not be empty. */
  points: TooltipPoint[];
  /** Axis titles; empty titles fall back to `x` and `y`. */
  labels: TooltipLabels;
  /** Size of the chart container that bounds the tooltip. */
  bounds: { width: number; height: number };
};

function SeriesKey({ symbol, color }: { symbol: string; color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      {symbol === "circle" ? (
        <circle cx="6" cy="6" r="4" fill={color} />
      ) : (
        <rect
          x={symbol === "diamond" ? 2.6 : 2}
          y={symbol === "diamond" ? 2.6 : 2}
          width={symbol === "diamond" ? 6.8 : 8}
          height={symbol === "diamond" ? 6.8 : 8}
          fill={color}
          transform={symbol === "diamond" ? "rotate(45 6 6)" : undefined}
        />
      )}
    </svg>
  );
}

/**
 * Renders the values and uncertainties of the active point and of any points
 * drawn on top of it, anchored beside the first point and kept inside the chart.
 *
 * The card never captures pointer events and is skipped by image export. Series
 * names and axis titles shrink with an ellipsis; numbers are never truncated.
 * @param props - Points to describe, axis titles, and the container size.
 * @returns The rendered React element.
 */
export function ChartTooltip({ points, labels, bounds }: ChartTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const anchor = points[0];
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { left, top } = placeTooltip(
      { x: anchor.px, y: anchor.py },
      { width: element.offsetWidth, height: element.offsetHeight },
      bounds,
    );
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  });
  const hidden = points.length - MAX_TOOLTIP_POINTS;
  return (
    <div
      ref={ref}
      role="tooltip"
      data-html2canvas-ignore="true"
      className="pointer-events-none absolute z-[2] grid w-max min-w-[150px] max-w-[min(320px,calc(100%-8px))] grid-cols-[minmax(0,1fr)] gap-1.5 rounded-lg border border-[#d8ded7] bg-white px-2.5 py-2 text-[11.5px] leading-[1.35] text-[#20272c] tabular-nums shadow-[0_1px_2px_rgba(32,39,44,0.06),0_8px_24px_rgba(32,39,44,0.14)]"
    >
      {points.length > 1 && (
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#66716e]">
          {points.length} pontos próximos
        </div>
      )}
      {points.slice(0, MAX_TOOLTIP_POINTS).map((point, position) => (
        <div
          key={`${point.seriesId}-${point.row}`}
          className={`min-w-0 ${position > 0 ? "border-t border-[#e9ece7] pt-1.5" : ""}`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <SeriesKey symbol={point.symbol} color={point.color} />
            <span className="min-w-0 flex-1 truncate font-semibold" title={point.seriesName}>
              {point.seriesName}
            </span>
            <span className="whitespace-nowrap text-[10.5px] text-[#66716e]">nº {point.row}</span>
          </div>
          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-2.5 gap-y-0.5">
            {(
              [
                [labels.x || "x", point.x, point.sx],
                [labels.y || "y", point.y, point.sy],
              ] as const
            ).map(([label, value, sigma], row) => (
              <Fragment key={row}>
                <span
                  className="min-w-0 max-w-[17ch] truncate text-[#66716e]"
                  dangerouslySetInnerHTML={{ __html: renderLabelHtml(label) }}
                />
                <span className="whitespace-nowrap text-right text-[12.5px] font-semibold">
                  {formatTooltipValue(value)}
                </span>
                <span className="whitespace-nowrap text-[#66716e]">
                  {sigma === undefined ? "" : `± ${formatTooltipValue(sigma)}`}
                </span>
              </Fragment>
            ))}
          </div>
        </div>
      ))}
      {hidden > 0 && (
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#66716e]">
          + {hidden} {hidden === 1 ? "outro ponto" : "outros pontos"}
        </div>
      )}
    </div>
  );
}
