import {
  bin,
  extent,
  line,
  scaleLinear,
  scaleLog,
  select,
  thresholdFreedmanDiaconis,
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
import type { ChartSettings } from "./useChartSettings";
import { EditableChartLabel } from "./EditableChartLabel";

export type ChartPoint = { x: number; y: number; sx?: number; sy?: number };
type ChartProps = {
  points: ChartPoint[];
  linePoints?: ChartPoint[];
  label: string;
  settings: ChartSettings;
  graphicRef: RefObject<HTMLDivElement | null>;
};
const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 5 }).format(n);
const finite = (p: ChartPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
function domain(values: number[], log: boolean): [number, number] {
  const [min, max] = extent(values.filter((n) => Number.isFinite(n) && (!log || n > 0)));
  if (min === undefined || max === undefined) return log ? [1, 10] : [0, 1];
  if (min === max)
    return log
      ? [min / 2, min * 2]
      : [min - (Math.abs(min) * 0.1 || 1), max + (Math.abs(max) * 0.1 || 1)];
  return [min, max];
}
export function Chart({ points, linePoints = [], label, settings, graphicRef }: ChartProps) {
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
    xLog,
    yLog,
    xMin,
    xMax,
    yMin,
    yMax,
    ticks,
    color,
    radius,
    symbol,
    lineStyle,
    lineWidth,
    mode,
    column,
    metric,
    bins,
    opacity,
    visible,
  } = settings;
  const [tooltip, setTooltip] = useState<string | null>(null);
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
      .on("zoom", (event) => setTransform(event.transform));
    zoomRef.current = behavior;
    select(el).call(behavior).on("dblclick.zoom", null);
    return () => {
      select(el).on(".zoom", null);
    };
  }, [size.width, size.height]);
  const valid = points.filter(finite);
  const values = valid
    .map((p) => p[column])
    .filter((v): v is number => v !== undefined && Number.isFinite(v));
  const rawBins = values.length
    ? bin().thresholds(
        bins > 0
          ? bins
          : thresholdFreedmanDiaconis(values, Math.min(...values), Math.max(...values)),
      )(values)
    : [];
  let accumulated = 0;
  const hist = rawBins.map((b) => {
    accumulated += b.length;
    const width = (b.x1 ?? 0) - (b.x0 ?? 0);
    return {
      x0: b.x0 ?? 0,
      x1: b.x1 ?? 0,
      count: b.length,
      value:
        metric === "percent"
          ? (100 * b.length) / values.length
          : metric === "density"
            ? width
              ? b.length / values.length / width
              : 0
            : metric === "cumulative"
              ? accumulated
              : b.length,
    };
  });
  const all = [...valid, ...linePoints.filter(finite)];
  const xValues =
    mode === "points"
      ? all.flatMap((p) => [p.x, p.x - (p.sx || 0), p.x + (p.sx || 0)])
      : hist.flatMap((b) => [b.x0, b.x1]);
  const yValues =
    mode === "points"
      ? all.flatMap((p) => [p.y, p.y - (p.sy || 0), p.y + (p.sy || 0)])
      : [0, ...hist.map((b) => b.value)];
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
  const path = line<ChartPoint>()
    .defined((p) => finite(p) && (!xLog || p.x > 0) && (!yLog || p.y > 0))
    .x((p) => x(p.x))
    .y((p) => y(p.y))(linePoints);
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
          <div ref={container} className="group relative min-h-0 min-w-0 flex-1">
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
                    {visible && mode === "points" && (
                      <>
                        {path && (
                          <path
                            d={path}
                            fill="none"
                            stroke="#364cff"
                            strokeWidth={lineWidth}
                            strokeDasharray={
                              { solid: "", dashed: "8 5", dotted: "2 4", dashdot: "8 4 2 4" }[
                                lineStyle
                              ]
                            }
                          />
                        )}
                        {valid
                          .filter((p) => (!xLog || p.x > 0) && (!yLog || p.y > 0))
                          .map((p, i) => (
                            <g
                              key={i}
                              onMouseEnter={() =>
                                setTooltip(
                                  `x: ${fmt(p.x)} · y: ${fmt(p.y)}${p.sx !== undefined ? ` · σx: ${fmt(p.sx)}` : ""}${p.sy !== undefined ? ` · σy: ${fmt(p.sy)}` : ""}`,
                                )
                              }
                              onMouseLeave={() => setTooltip(null)}
                            >
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
                      </>
                    )}
                    {visible &&
                      mode === "histogram" &&
                      hist
                        .filter((b) => (!xLog || b.x0 > 0) && (!yLog || b.value > 0))
                        .map((b, i) => (
                          <rect
                            key={i}
                            x={x(b.x0)}
                            y={y(b.value)}
                            width={Math.max(0, x(b.x1) - x(b.x0) - 1)}
                            height={Math.max(0, y(yLog ? baseY.domain()[0] : 0) - y(b.value))}
                            fill={color}
                            opacity={opacity}
                            onMouseEnter={() =>
                              setTooltip(
                                `Intervalo: ${fmt(b.x0)}–${fmt(b.x1)} · Valor: ${fmt(b.value)} · Contagem: ${b.count}`,
                              )
                            }
                            onMouseLeave={() => setTooltip(null)}
                          />
                        ))}
                  </g>
                </g>
              </svg>
            )}
            {tooltip && (
              <div className="pointer-events-none absolute left-2 top-2 rounded border bg-white p-2 text-[11px] shadow">
                {tooltip}
              </div>
            )}
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
        {legend && (
          <div className="pt-1 text-center text-[11px] text-[#66716e]">
            <span style={{ color }}>●</span> Dados de exemplo{" "}
            {mode === "points" && linePoints.length > 0 && (
              <span className="ml-4 text-[#364cff]">━ Reta de exemplo</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
