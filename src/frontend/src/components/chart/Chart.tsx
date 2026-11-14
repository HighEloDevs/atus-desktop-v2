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
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Info,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { chartLinePatterns, type ChartSettings } from "./useChartSettings";
import { HISTOGRAM_GUTTER, ResidualPanel } from "./ResidualPanel";
import { hasResiduals, residualYDomain, type ChartResidual } from "./residuals";
import { EditableChartLabel } from "./EditableChartLabel";
import { ChartTooltip } from "./ChartTooltip";
import { axisPosition } from "./axisPosition";
import { densifyCurve } from "./curvePath";
import {
  AXIS_COLORS,
  formatAxisTick,
  formatResidualTick,
  majorTicks,
  minorTicks,
  xLabelSpace,
  yLabelGap,
  yLabelWidth,
  type AxisKey,
  type AxisSettings,
} from "./axisSettings";
import { AxisGrid, TickMarks, XTickLabels, YTickLabels } from "./AxisMarks";
import { AxisSettingsPopover } from "./AxisSettingsPopover";
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
  /** Residuals of the latest fit, when there is one. */
  residuals?: ChartResidual[];
};
type ChartProps = {
  series: ChartSeries[];
  label: string;
  settings: ChartSettings;
  graphicRef: RefObject<HTMLDivElement | null>;
  highlightedSeriesId?: string | null;
  /** Keys that run the fits, shown in the notice about missing residuals (e.g. "⌘ ↵"). */
  fitShortcut?: string;
};
const finite = (p: ChartPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
/** Points drawn per curve segment when an axis is logarithmic. */
const CURVE_STEPS = 256;
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
 *
 * When the settings request residuals and a visible series has them, a residuals panel
 * shares the X scale below the plot. Without residuals a quiet notice explains why the
 * panel is unavailable.
 * @param props - Series, labels, chart settings, export ref, highlighted series, and fit shortcut.
 * @returns The rendered React element.
 */
export function Chart({
  series,
  label,
  settings,
  graphicRef,
  highlightedSeriesId,
  fitShortcut,
}: ChartProps) {
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
    legend,
    legendOrientation,
    legendPosition,
    setLegendPosition,
    xAxis,
    yAxis,
    updateAxis,
    residuals,
    residualHistogram,
    residualErrorBars,
    residualAxis,
  } = settings;
  const xLog = xAxis.log;
  const yLog = yAxis.log;
  const [hotAxis, setHotAxis] = useState<AxisKey | null>(null);
  const highlightX = useCallback(
    (on: boolean) => setHotAxis((current) => (on ? "x" : current === "x" ? null : current)),
    [],
  );
  const highlightY = useCallback(
    (on: boolean) => setHotAxis((current) => (on ? "y" : current === "y" ? null : current)),
    [],
  );
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
  const limits = (vals: number[], axis: AxisSettings): [number, number] => {
    const d = domain(vals, axis.log);
    const a = axis.min === "" ? d[0] : Number(axis.min);
    const b = axis.max === "" ? d[1] : Number(axis.max);
    return Number.isFinite(a) && Number.isFinite(b) && a < b && (!axis.log || a > 0) ? [a, b] : d;
  };
  const { width, height } = size;
  const residualsAvailable = hasResiduals(series);
  const panelOn = residuals && residualsAvailable;
  const right = 25 + (panelOn && residualHistogram ? HISTOGRAM_GUTTER : 0);
  const xDomain = limits(xValues, xAxis);
  const yDomain = limits(yValues, yAxis);
  /** Scales and ticks for given left and bottom margins (the margins depend on the labels). */
  const layout = (left: number, bottom: number) => {
    const w = Math.max(1, width - left - right);
    const h = Math.max(1, height - 16 - bottom);
    const baseX = (xLog ? scaleLog() : scaleLinear())
      .domain(xDomain)
      .range(xAxis.invert ? [w, 0] : [0, w]);
    const baseY = (yLog ? scaleLog() : scaleLinear())
      .domain(yDomain)
      .range(yAxis.invert ? [0, h] : [h, 0]);
    const x = transform.rescaleX(baseX);
    const y = transform.rescaleY(baseY);
    return { w, h, x, y, xt: majorTicks(x, xAxis), yt: majorTicks(y, yAxis) };
  };
  const draft = layout(65, panelOn ? 8 : 38);
  const xSpace = xLabelSpace(
    draft.xt.map((t) => formatAxisTick(t, xAxis)),
    xAxis,
  );
  const ySpace =
    yLabelWidth(
      draft.yt.map((t) => formatAxisTick(t, yAxis)),
      yAxis,
    ) +
    yLabelGap(yAxis) +
    4;
  // The residuals panel shares the left margin, so its labels count too.
  const residualTicks = panelOn
    ? majorTicks(
        scaleLinear().domain(
          residualYDomain(series, residualErrorBars, residualAxis.min, residualAxis.max),
        ),
        residualAxis,
      )
    : [];
  const residualSpace = panelOn
    ? yLabelWidth(
        residualTicks.map((t) => formatResidualTick(t, residualAxis)),
        residualAxis,
      ) +
      yLabelGap(residualAxis) +
      4
    : 0;
  const margin = {
    top: 16,
    right,
    bottom: panelOn ? 8 : Math.max(38, xSpace),
    left: Math.max(65, Math.ceil(ySpace), Math.ceil(residualSpace)),
  };
  const { w, h, x, y, xt, yt } = layout(margin.left, margin.bottom);
  const xm = minorTicks(x, xAxis, xt);
  const ym = minorTicks(y, yAxis, yt);
  const visibleDomain = (scale: { domain(): number[] }): [number, number] => {
    const [a, b] = scale.domain();
    return a <= b ? [a, b] : [b, a];
  };
  const axes = axisPosition(
    (v) => x(v),
    (v) => y(v),
    w,
    h,
    xLog,
    yLog,
    { x: xAxis.edge, y: yAxis.edge },
  );
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
        <div className={`flex min-h-0 ${panelOn ? "flex-[68_1_0%]" : "flex-1"}`}>
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
              fontSize={yAxis.titleSize}
              rotated={yAxis.titleRotation === 90}
              onFontSizeChange={(titleSize) => updateAxis("y", { titleSize })}
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
                  <AxisGrid
                    axis="x"
                    majors={xt}
                    minors={xm}
                    scale={x}
                    width={w}
                    height={h}
                    settings={xAxis}
                  />
                  <AxisGrid
                    axis="y"
                    majors={yt}
                    minors={ym}
                    scale={y}
                    width={w}
                    height={h}
                    settings={yAxis}
                  />
                  {!panelOn && (
                    <XTickLabels
                      ticks={xt}
                      scale={x}
                      bottom={h}
                      settings={xAxis}
                      highlighted={hotAxis === "x"}
                    />
                  )}
                  <YTickLabels
                    ticks={yt}
                    scale={y}
                    settings={yAxis}
                    highlighted={hotAxis === "y"}
                  />
                  <line
                    x1={0}
                    x2={w}
                    y1={axes.y}
                    y2={axes.y}
                    stroke={hotAxis === "x" ? AXIS_COLORS.lineHighlight : AXIS_COLORS.line}
                    strokeWidth={hotAxis === "x" ? 2 : 1}
                  />
                  <line
                    x1={axes.x}
                    x2={axes.x}
                    y1={0}
                    y2={h}
                    stroke={hotAxis === "y" ? AXIS_COLORS.lineHighlight : AXIS_COLORS.line}
                    strokeWidth={hotAxis === "y" ? 2 : 1}
                  />
                  <TickMarks
                    axis="x"
                    majors={xt}
                    minors={xm}
                    scale={x}
                    at={axes.y}
                    settings={xAxis}
                  />
                  <TickMarks
                    axis="y"
                    majors={yt}
                    minors={ym}
                    scale={y}
                    at={axes.x}
                    settings={yAxis}
                  />
                  <g clipPath={`url(#${clipId})`}>
                    {visibleSeries.map(
                      ({ id, points, linePoints, color, radius, symbol, lineStyle, lineWidth }) => {
                        const valid = points
                          .map((p, index) => ({ ...p, row: index + 1 }))
                          .filter(finite);
                        const path = line<ChartPoint>()
                          .defined((p) => finite(p) && (!xLog || p.x > 0) && (!yLog || p.y > 0))
                          .x((p) => x(p.x))
                          .y((p) => y(p.y))(
                          // Straight segments in the data bend on a log scale.
                          densifyCurve(linePoints, xLog || yLog ? CURVE_STEPS : 1),
                        );
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
            {width > 90 && height > 55 && (
              <AxisSettingsPopover
                axis="y"
                settings={settings}
                box={{ left: 2, top: margin.top - 6, width: margin.left - 6, height: h + 12 }}
                domain={visibleDomain(y)}
                onHighlightChange={highlightY}
              />
            )}
            {width > 90 && height > 55 && !panelOn && (
              <AxisSettingsPopover
                axis="x"
                settings={settings}
                box={{
                  left: margin.left - 6,
                  top: margin.top + h + 3,
                  width: w + 12,
                  height: margin.bottom - 4,
                }}
                domain={visibleDomain(x)}
                onHighlightChange={highlightX}
              />
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
        {panelOn && (
          <ResidualPanel
            series={series}
            x={(value) => x(value)}
            xTicks={xt}
            xMinorTicks={xm}
            xLog={xLog}
            xHighlighted={hotAxis === "x"}
            bottom={Math.max(24, xSpace - 3)}
            xAxisControl={(box) => (
              <AxisSettingsPopover
                axis="x"
                settings={settings}
                box={box}
                domain={visibleDomain(x)}
                onHighlightChange={highlightX}
              />
            )}
            margin={{ left: margin.left, right: margin.right }}
            settings={settings}
            highlightedSeriesId={highlightedSeriesId}
          />
        )}
        <div className="ml-16 px-2 text-[11px] text-[#66716e]" style={{ textAlign: xAlignment }}>
          <EditableChartLabel
            value={xLabel}
            onChange={setXLabel}
            fontSize={xAxis.titleSize}
            onFontSizeChange={(titleSize) => updateAxis("x", { titleSize })}
            label="Editar título do eixo X"
            placeholder="Eixo X"
            alignment={xAlignment}
            onAlignmentChange={setXAlignment}
          />
        </div>
      </div>
      {!residualsAvailable && (
        <p
          role="status"
          className="flex items-center gap-2 border-t border-dashed border-border pt-2 text-xs text-muted-foreground"
        >
          <Info size={14} aria-hidden="true" className="shrink-0" />
          <span>
            Resíduos desabilitados porque ainda não há resíduos.
            {fitShortcut ? ` Execute o ajuste com ${fitShortcut}.` : ""}
          </span>
        </p>
      )}
    </div>
  );
}
