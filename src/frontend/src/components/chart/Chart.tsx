/**
 * @module
 * D3 chart rendering and interactive data inspection.
 */

import {
  extent,
  line,
  scaleLinear,
  scaleLog,
  select,
  zoom,
  zoomIdentity,
  type ZoomTransform,
} from "d3";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { chartLinePatterns, type ChartSettings } from "./useChartSettings";
import { EditableChartLabel } from "./EditableChartLabel";
import { ChartTooltip } from "./ChartTooltip";
import {
  describeTooltip,
  groupNearbyPoints,
  keyboardOrder,
  type TooltipPoint,
} from "./tooltipModel";

export type ChartPoint = { x: number; y: number; sx?: number; sy?: number };
export type ChartSeries = {
  id: string;
  name: string;
  points: ChartPoint[];
  linePoints: ChartPoint[];
  color: string;
  radius: number;
  symbol: string;
  lineStyle: keyof typeof chartLinePatterns;
  lineWidth: number;
  visible: boolean;
};
type ChartProps = {
  series: ChartSeries[];
  label: string;
  settings: ChartSettings;
  graphicRef: RefObject<HTMLDivElement | null>;
  highlightedSeriesId?: string | null;
};
const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 5 }).format(n);
const finite = (p: ChartPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
/** Smallest pointer target radius, in pixels, around a data point. */
const HIT_RADIUS = 12;
function domain(values: number[], log: boolean): [number, number] {
  const [min, max] = extent(values.filter((n) => Number.isFinite(n) && (!log || n > 0)));
  if (min === undefined || max === undefined) return log ? [1, 10] : [0, 1];
  if (min === max)
    return log
      ? [min / 2, min * 2]
      : [min - (Math.abs(min) * 0.1 || 1), max + (Math.abs(max) * 0.1 || 1)];
  return [min, max];
}
/**
 * Renders ordered series with D3 and handles chart interaction.
 *
 * Hovering a point, or focusing the plot and pressing the arrow keys, shows a
 * tooltip beside it with its values and uncertainties; coincident points share
 * one tooltip. Escape, blur, and the start of a zoom or pan dismiss it.
 * @param props - Series, labels, chart settings, export ref, and optional highlighted series.
 * @returns The rendered React element.
 */
export function Chart({ series, label, settings, graphicRef, highlightedSeriesId }: ChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId().replace(/:/g, "");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const {
    title,
    setTitle,
    titleAlignment,
    setTitleAlignment,
    subtitleAlignment,
    setSubtitleAlignment,
    subtitle,
    setSubtitle,
    xAlignment,
    setXAlignment,
    yAlignment,
    setYAlignment,
    xLabel,
    setXLabel,
    yLabel,
    setYLabel,
    grid,
    legend,
    legendOrientation,
    legendPosition,
    setLegendPosition,
    xLog,
    yLog,
    xMin,
    xMax,
    yMin,
    yMax,
    ticks,
  } = settings;
  const legendDrag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [active, setActive] = useState<{ seriesId: string; row: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const zoomRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 32])
      .on("start", () => {
        setActive(null);
        setAnnouncement("");
      })
      .on("zoom", (event) => setTransform(event.transform));
    zoomRef.current = behavior;
    select(el).call(behavior).on("dblclick.zoom", null);
    return () => {
      select(el).on(".zoom", null);
    };
  }, [size.width, size.height]);
  const visibleSeries = series.filter((item) => item.visible);
  const all = visibleSeries.flatMap((item) => [
    ...item.points.filter(finite),
    ...item.linePoints.filter(finite),
  ]);
  const xValues = all.flatMap((p) => [p.x, p.x - (p.sx || 0), p.x + (p.sx || 0)]);
  const yValues = all.flatMap((p) => [p.y, p.y - (p.sy || 0), p.y + (p.sy || 0)]);
  const limits = (vals: number[], log: boolean, low: string, high: string): [number, number] => {
    const d = domain(vals, log);
    const a = low === "" ? d[0] : Number(low);
    const b = high === "" ? d[1] : Number(high);
    return Number.isFinite(a) && Number.isFinite(b) && a < b && (!log || a > 0) ? [a, b] : d;
  };
  const { width, height } = size;
  const margin = { top: 16, right: 25, bottom: 38, left: 65 };
  const w = Math.max(1, width - margin.left - margin.right);
  const h = Math.max(1, height - margin.top - margin.bottom);
  const baseX = (xLog ? scaleLog() : scaleLinear())
    .domain(limits(xValues, xLog, xMin, xMax))
    .range([0, w]);
  const baseY = (yLog ? scaleLog() : scaleLinear())
    .domain(limits(yValues, yLog, yMin, yMax))
    .range([h, 0]);
  const x = transform.rescaleX(baseX);
  const y = transform.rescaleY(baseY);
  const xt = x.ticks(ticks);
  const yt = y.ticks(ticks);
  const zoomBy = (factor: number) => {
    if (svgRef.current && zoomRef.current)
      select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };
  const panBy = (dx: number, dy: number) => {
    if (svgRef.current && zoomRef.current)
      select(svgRef.current).call(zoomRef.current.translateBy, dx / transform.k, dy / transform.k);
  };
  const reset = () => {
    if (svgRef.current && zoomRef.current)
      select(svgRef.current).call(zoomRef.current.transform, zoomIdentity);
  };
  const plotted: TooltipPoint[] = visibleSeries.flatMap((item) =>
    item.points.flatMap((p, index) =>
      finite(p) && (!xLog || p.x > 0) && (!yLog || p.y > 0)
        ? [
            {
              seriesId: item.id,
              seriesName: item.name,
              color: item.color,
              symbol: item.symbol,
              row: index + 1,
              x: p.x,
              y: p.y,
              sx: p.sx,
              sy: p.sy,
              px: margin.left + x(p.x),
              py: margin.top + y(p.y),
            },
          ]
        : [],
    ),
  );
  const tooltipLabels = { x: xLabel, y: yLabel };
  const target = active
    ? plotted.find((p) => p.seriesId === active.seriesId && p.row === active.row)
    : undefined;
  const tooltipPoints = target ? groupNearbyPoints(plotted, target) : [];
  const dismissTooltip = () => {
    setActive(null);
    setAnnouncement("");
  };
  const stepTooltip = (pick: (order: TooltipPoint[], current: number) => number) => {
    const order = keyboardOrder(
      plotted.filter(
        (p) =>
          p.px >= margin.left &&
          p.px <= margin.left + w &&
          p.py >= margin.top &&
          p.py <= margin.top + h,
      ),
    );
    if (!order.length) return;
    const current = target ? order.indexOf(target) : -1;
    const next = order[(pick(order, current) + order.length) % order.length];
    setActive({ seriesId: next.seriesId, row: next.row });
    setAnnouncement(describeTooltip(groupNearbyPoints(plotted, next), tooltipLabels));
  };
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={graphicRef} className="flex min-h-0 flex-1 flex-col bg-white">
        <div>
          <div className="px-2 text-[13px] font-semibold" style={{ textAlign: titleAlignment }}>
            <EditableChartLabel
              alignment={titleAlignment}
              onAlignmentChange={setTitleAlignment}
              value={title}
              initialFontSize={13}
              onChange={setTitle}
              label="Editar título do gráfico"
              placeholder="Adicionar título"
            />
          </div>
          <div className="px-2 text-[11px] text-[#758078]" style={{ textAlign: subtitleAlignment }}>
            <EditableChartLabel
              alignment={subtitleAlignment}
              onAlignmentChange={setSubtitleAlignment}
              value={subtitle}
              onChange={setSubtitle}
              label="Editar subtítulo do gráfico"
              placeholder="Adicionar subtítulo"
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <div
            className="flex w-16 shrink-0 flex-col items-center text-[11px] text-[#66716e]"
            style={{
              justifyContent:
                yAlignment === "left"
                  ? "flex-start"
                  : yAlignment === "right"
                    ? "flex-end"
                    : "center",
            }}
          >
            <EditableChartLabel
              value={yLabel}
              onChange={setYLabel}
              label="Editar título do eixo Y"
              placeholder="Eixo Y"
              orientation="vertical"
              alignment={yAlignment}
              onAlignmentChange={setYAlignment}
            />
          </div>
          <div
            ref={container}
            role="group"
            tabIndex={0}
            aria-label="Pontos do gráfico. Use as setas para percorrer os pontos e Esc para fechar o detalhe."
            className="group relative min-h-0 min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#364cff]"
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Escape") return dismissTooltip();
              const picks: Record<string, (order: TooltipPoint[], current: number) => number> = {
                ArrowRight: (_, current) => current + 1,
                ArrowDown: (_, current) => current + 1,
                ArrowLeft: (order, current) => (current < 0 ? order.length : current) - 1,
                ArrowUp: (order, current) => (current < 0 ? order.length : current) - 1,
                Home: () => 0,
                End: (order) => order.length - 1,
              };
              const pick = picks[event.key];
              if (!pick) return;
              event.preventDefault();
              stepTooltip(pick);
            }}
            onBlur={(event) => {
              if (event.target === event.currentTarget) dismissTooltip();
            }}
          >
            <div
              role="toolbar"
              aria-label="Navegação do gráfico"
              data-html2canvas-ignore="true"
              className="chart-navigation pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-[#d8ded7] bg-white p-1 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => panBy(40, 0)}
                aria-label="Mover visualização para a esquerda"
                title="Mover para a esquerda"
              >
                <ArrowLeft />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => panBy(-40, 0)}
                aria-label="Mover visualização para a direita"
                title="Mover para a direita"
              >
                <ArrowRight />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => panBy(0, 40)}
                aria-label="Mover visualização para cima"
                title="Mover para cima"
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => panBy(0, -40)}
                aria-label="Mover visualização para baixo"
                title="Mover para baixo"
              >
                <ArrowDown />
              </Button>
              <span className="mx-0.5 h-4 w-px bg-[#d8ded7]" aria-hidden="true" />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => zoomBy(1.2)}
                aria-label="Ampliar gráfico"
                title="Ampliar"
              >
                <ZoomIn />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => zoomBy(0.8)}
                aria-label="Reduzir gráfico"
                title="Reduzir"
              >
                <ZoomOut />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={reset}
                aria-label="Restaurar visualização"
                title="Restaurar visualização"
              >
                <RotateCcw />
              </Button>
            </div>
            {width > 90 && height > 55 && (
              <svg
                ref={svgRef}
                width={width}
                height={height}
                role="img"
                aria-label={label}
                className="cursor-grab active:cursor-grabbing"
              >
                <defs>
                  <clipPath id={clipId}>
                    <rect width={w} height={h} />
                  </clipPath>
                </defs>
                <g transform={`translate(${margin.left},${margin.top})`}>
                  {xt.map((t) => (
                    <g key={t} transform={`translate(${x(t)},0)`}>
                      {grid && <line y2={h} stroke="#e8ece7" />}
                      <text y={h + 16} textAnchor="middle" fontSize="10" fill="#78857d">
                        {fmt(t)}
                      </text>
                    </g>
                  ))}
                  {yt.map((t) => (
                    <g key={t} transform={`translate(0,${y(t)})`}>
                      {grid && <line x2={w} stroke="#e8ece7" />}
                      <text x={-8} dy=".32em" textAnchor="end" fontSize="10" fill="#78857d">
                        {fmt(t)}
                      </text>
                    </g>
                  ))}
                  <path d={`M0 0V${h}H${w}`} fill="none" stroke="#aebbb0" />
                  <g clipPath={`url(#${clipId})`}>
                    {visibleSeries.map(
                      ({ id, points, linePoints, color, radius, symbol, lineStyle, lineWidth }) => {
                        const valid = points
                          .map((p, index) => ({ ...p, row: index + 1 }))
                          .filter(finite);
                        const path = line<ChartPoint>()
                          .defined((p) => finite(p) && (!xLog || p.x > 0) && (!yLog || p.y > 0))
                          .x((p) => x(p.x))
                          .y((p) => y(p.y))(linePoints);
                        return (
                          <g
                            key={id}
                            opacity={highlightedSeriesId && highlightedSeriesId !== id ? 0.15 : 1}
                          >
                            {path && (
                              <path
                                d={path}
                                fill="none"
                                stroke={color}
                                strokeWidth={lineWidth}
                                strokeDasharray={chartLinePatterns[lineStyle]}
                              />
                            )}
                            {valid
                              .filter((p) => (!xLog || p.x > 0) && (!yLog || p.y > 0))
                              .map((p) => (
                                <g
                                  key={p.row}
                                  onMouseEnter={() => {
                                    setActive({ seriesId: id, row: p.row });
                                    setAnnouncement("");
                                  }}
                                  onMouseLeave={dismissTooltip}
                                >
                                  <circle
                                    cx={x(p.x)}
                                    cy={y(p.y)}
                                    r={Math.max(radius, HIT_RADIUS)}
                                    fill="transparent"
                                  />
                                  {p.sx && (!xLog || p.x - p.sx > 0) ? (
                                    <line
                                      x1={x(p.x - p.sx)}
                                      x2={x(p.x + p.sx)}
                                      y1={y(p.y)}
                                      y2={y(p.y)}
                                      stroke={color}
                                    />
                                  ) : null}
                                  {p.sy && (!yLog || p.y - p.sy > 0) ? (
                                    <line
                                      x1={x(p.x)}
                                      x2={x(p.x)}
                                      y1={y(p.y - p.sy)}
                                      y2={y(p.y + p.sy)}
                                      stroke={color}
                                    />
                                  ) : null}
                                  {symbol === "circle" ? (
                                    <circle cx={x(p.x)} cy={y(p.y)} r={radius} fill={color} />
                                  ) : (
                                    <rect
                                      x={x(p.x) - radius}
                                      y={y(p.y) - radius}
                                      width={radius * 2}
                                      height={radius * 2}
                                      fill={color}
                                      transform={
                                        symbol === "diamond"
                                          ? `rotate(45 ${x(p.x)} ${y(p.y)})`
                                          : undefined
                                      }
                                    />
                                  )}
                                </g>
                              ))}
                          </g>
                        );
                      },
                    )}
                    {target && (
                      <g pointerEvents="none">
                        <path
                          d={`M0 ${target.py - margin.top}H${target.px - margin.left}V${h}`}
                          fill="none"
                          stroke="#8b978f"
                          strokeDasharray="3 3"
                        />
                        {[
                          { stroke: "#ffffff", strokeWidth: 3 },
                          { stroke: target.color, strokeWidth: 1.5 },
                        ].map((ring) => (
                          <circle
                            key={ring.stroke + ring.strokeWidth}
                            cx={target.px - margin.left}
                            cy={target.py - margin.top}
                            r={
                              (visibleSeries.find((item) => item.id === target.seriesId)?.radius ??
                                5) + 4.5
                            }
                            fill="none"
                            {...ring}
                          />
                        ))}
                      </g>
                    )}
                  </g>
                </g>
              </svg>
            )}
            {legend && (
              <div
                className={`absolute z-[1] flex max-w-full touch-none cursor-grab select-none gap-x-4 gap-y-1 rounded bg-white/90 px-2 py-1 text-[11px] text-[#66716e] active:cursor-grabbing ${legendOrientation === "vertical" ? "flex-col" : "flex-row flex-wrap"}`}
                style={{
                  left: `${legendPosition.x * 100}%`,
                  top: `${legendPosition.y * 100}%`,
                  transform: `translate(${-legendPosition.x * 100}%, ${-legendPosition.y * 100}%)`,
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  legendDrag.current = {
                    pointerId: event.pointerId,
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                  event.stopPropagation();
                }}
                onPointerMove={(event) => {
                  const drag = legendDrag.current;
                  const parent = container.current;
                  if (!drag || drag.pointerId !== event.pointerId || !parent) return;
                  const bounds = parent.getBoundingClientRect();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const availableX = Math.max(0, bounds.width - rect.width);
                  const availableY = Math.max(0, bounds.height - rect.height);
                  setLegendPosition({
                    x: availableX
                      ? Math.max(
                          0,
                          Math.min(1, (event.clientX - bounds.left - drag.offsetX) / availableX),
                        )
                      : 0,
                    y: availableY
                      ? Math.max(
                          0,
                          Math.min(1, (event.clientY - bounds.top - drag.offsetY) / availableY),
                        )
                      : 0,
                  });
                }}
                onPointerUp={() => {
                  legendDrag.current = null;
                }}
                onPointerCancel={() => {
                  legendDrag.current = null;
                }}
              >
                {visibleSeries.map((item) => (
                  <span key={item.id} className="whitespace-nowrap">
                    <span style={{ color: item.color }}>●</span> {item.name}
                  </span>
                ))}
              </div>
            )}
            {tooltipPoints.length > 0 && (
              <ChartTooltip points={tooltipPoints} labels={tooltipLabels} bounds={size} />
            )}
            <div aria-live="polite" className="sr-only">
              {announcement}
            </div>
          </div>
        </div>
        <div className="ml-16 px-2 text-[11px] text-[#66716e]" style={{ textAlign: xAlignment }}>
          <EditableChartLabel
            value={xLabel}
            onChange={setXLabel}
            label="Editar título do eixo X"
            placeholder="Eixo X"
            alignment={xAlignment}
            onAlignmentChange={setXAlignment}
          />
        </div>
      </div>
    </div>
  );
}
