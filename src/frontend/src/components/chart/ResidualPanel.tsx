/**
 * @module
 * Residuals panel drawn under the main chart, sharing its X scale.
 */

import { scaleLinear } from "d3";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SettingSwitch } from "@/components/ui/setting-switch";
import { formatSignificant } from "@/features/analysis/fit/result-format";
import type { ChartSeries } from "./Chart";
import { EditableChartLabel } from "./EditableChartLabel";
import {
  formatTick,
  residualDomain,
  residualHistogram as binResiduals,
  residualSigma,
  type ChartResidual,
} from "./residuals";
import { residualDefaults, type ChartSettings } from "./useChartSettings";

/** Width, in pixels, of the column that holds the lateral histogram. */
export const HISTOGRAM_GUTTER = 56;
const TOP = 10;
const BOTTOM = 24;
const BINS = 8;

type Props = {
  series: ChartSeries[];
  /** X scale of the main chart, already zoomed; maps data to the plot area. */
  x: (value: number) => number;
  xTicks: number[];
  xLog: boolean;
  /** Left and right margin shared with the main chart. */
  margin: { left: number; right: number };
  settings: ChartSettings;
  highlightedSeriesId?: string | null;
};

const signed = (value: number) =>
  value === 0 ? "0" : `${value > 0 ? "+" : "−"}${formatSignificant(Math.abs(value), 2)}`;

/**
 * Draws the residuals of every visible series against X, aligned with the main plot.
 *
 * The Y axis is symmetric around zero unless the user sets limits. The stems, the ±σ
 * band, the uncertainty bars and the lateral histogram are toggled from the options
 * popover, which also holds the Y limits. The Y title is editable like the other labels.
 * @param props - Series, the shared X scale, margins, chart settings, and highlighted series.
 * @returns The rendered React element.
 */
export function ResidualPanel({
  series,
  x,
  xTicks,
  xLog,
  margin,
  settings,
  highlightedSeriesId,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const {
    grid,
    residualYLabel,
    setResidualYLabel,
    residualYMin,
    residualYMax,
    residualStems,
    residualBand,
    residualErrorBars,
    residualHistogram,
  } = settings;
  const visible = series.filter((item) => item.visible);
  const all = visible.flatMap((item) =>
    (item.residuals ?? []).filter((r) => Number.isFinite(r.x) && Number.isFinite(r.residual)),
  );
  const sigma = residualSigma(visible);
  const domainValues = all.flatMap((r) => [
    r.residual,
    ...(residualErrorBars && r.sy ? [r.residual - r.sy, r.residual + r.sy] : []),
  ]);
  const [lo, hi] = residualDomain(domainValues, residualYMin, residualYMax);
  const { width, height } = size;
  const w = Math.max(1, width - margin.left - margin.right);
  const h = Math.max(1, height - TOP - BOTTOM);
  const y = scaleLinear().domain([lo, hi]).range([h, 0]);
  const yTicks = y.ticks(Math.max(2, Math.round(h / 40)));
  const bins = binResiduals(
    all.map((r) => r.residual),
    [lo, hi],
    BINS,
  );
  const peak = Math.max(1, ...bins.map((bin) => bin.count));
  const histogramX = w + 14;
  const inside = (r: ChartResidual) => !xLog || r.x > 0;
  return (
    <div className="flex min-h-0 flex-[32_1_0%] border-t border-[#d8ded7]">
      <div className="flex w-16 shrink-0 items-center justify-center text-[11px] text-[#66716e]">
        <EditableChartLabel
          value={residualYLabel}
          onChange={setResidualYLabel}
          label="Editar título do eixo Y dos resíduos"
          placeholder="Resíduo"
          orientation="vertical"
        />
      </div>
      <div ref={container} className="relative min-h-0 min-w-0 flex-1">
        <div data-html2canvas-ignore="true" className="absolute right-2 top-1 z-10">
          <ResidualOptions settings={settings} hasSigma={sigma !== null} />
        </div>
        {width > 90 && height > 55 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Resíduos de cada ponto em função de x"
          >
            <defs>
              <clipPath id="residual-clip">
                <rect width={w} height={h} />
              </clipPath>
            </defs>
            <g transform={`translate(${margin.left},${TOP})`}>
              {xTicks.map((t) => (
                <g key={t} transform={`translate(${x(t)},0)`}>
                  {grid && <line y2={h} stroke="#e8ece7" />}
                  <text y={h + 16} textAnchor="middle" fontSize="10" fill="#78857d">
                    {formatTick(t)}
                  </text>
                </g>
              ))}
              {yTicks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  {grid && <line x2={w} stroke="#e8ece7" />}
                  <text x={-8} dy=".32em" textAnchor="end" fontSize="10" fill="#78857d">
                    {signed(t)}
                  </text>
                </g>
              ))}
              <g clipPath="url(#residual-clip)">
                {residualBand && sigma !== null && (
                  <rect
                    data-testid="residual-band"
                    x={0}
                    y={y(sigma)}
                    width={w}
                    height={Math.max(0, y(-sigma) - y(sigma))}
                    fill="#364cff"
                    opacity="0.08"
                  />
                )}
                <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="#66716e" />
                {visible.map((item) => (
                  <g
                    key={item.id}
                    opacity={highlightedSeriesId && highlightedSeriesId !== item.id ? 0.15 : 1}
                  >
                    {(item.residuals ?? [])
                      .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.residual))
                      .filter(inside)
                      .map((r) => (
                        <g key={`${r.x}-${r.residual}`}>
                          {residualStems && (
                            <line
                              data-testid="residual-stem"
                              x1={x(r.x)}
                              x2={x(r.x)}
                              y1={y(0)}
                              y2={y(r.residual)}
                              stroke={item.color}
                              strokeWidth="2"
                              opacity="0.45"
                            />
                          )}
                          {residualErrorBars && r.sy ? (
                            <line
                              data-testid="residual-error"
                              x1={x(r.x)}
                              x2={x(r.x)}
                              y1={y(r.residual - r.sy)}
                              y2={y(r.residual + r.sy)}
                              stroke={item.color}
                            />
                          ) : null}
                          <circle
                            cx={x(r.x)}
                            cy={y(r.residual)}
                            r={Math.min(item.radius, 5)}
                            fill={item.color}
                          >
                            <title>{`x = ${formatTick(r.x)}; resíduo = ${formatTick(r.residual)}`}</title>
                          </circle>
                        </g>
                      ))}
                  </g>
                ))}
              </g>
              {residualHistogram && (
                <g data-testid="residual-histogram" aria-hidden="true">
                  <line x1={histogramX} x2={histogramX} y1={0} y2={h} stroke="#d8ded7" />
                  {bins.map((bin) => (
                    <rect
                      key={bin.from}
                      x={histogramX}
                      y={y(bin.to) + 1}
                      width={
                        bin.count ? Math.max(3, (bin.count / peak) * (HISTOGRAM_GUTTER - 20)) : 0
                      }
                      height={Math.max(0, y(bin.from) - y(bin.to) - 2)}
                      rx="2"
                      fill="#66716e"
                      opacity="0.3"
                    />
                  ))}
                </g>
              )}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}

/**
 * Popover with the residuals panel options: Y limits and which elements to show.
 * @param props - Chart settings and whether the data carry Y uncertainties.
 * @returns The rendered React element.
 */
function ResidualOptions({ settings, hasSigma }: { settings: ChartSettings; hasSigma: boolean }) {
  const {
    residualYMin,
    setResidualYMin,
    residualYMax,
    setResidualYMax,
    residualStems,
    setResidualStems,
    residualBand,
    setResidualBand,
    residualErrorBars,
    setResidualErrorBars,
    residualHistogram,
    setResidualHistogram,
    setResidualYLabel,
  } = settings;
  const manual = residualYMin !== "" || residualYMax !== "";
  const needsSigma = "Requer incertezas em Y nos dados.";
  const restore = () => {
    setResidualYMin("");
    setResidualYMax("");
    setResidualStems(residualDefaults.stems);
    setResidualBand(residualDefaults.band);
    setResidualErrorBars(residualDefaults.errorBars);
    setResidualHistogram(residualDefaults.histogram);
    setResidualYLabel(residualDefaults.yLabel);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Opções do painel de resíduos"
          title="Opções do painel de resíduos"
          className="grid size-7 place-items-center rounded-md border border-[#d8ded7] bg-white text-[#66716e] hover:bg-[#eff2ed] focus-visible:outline-2 focus-visible:outline-[#364cff] data-[state=open]:bg-[#eff2ed]"
        >
          <SlidersHorizontal size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[320px] p-0">
        <div className="px-4 pb-2 pt-3.5 text-[13px] font-semibold">Painel de resíduos</div>
        <div className="space-y-2 border-t border-border px-4 py-3">
          <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Escala Y
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10.5px] normal-case tracking-normal text-foreground">
              {manual ? "manual" : "automática"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] text-muted-foreground" htmlFor="residual-ymin">
              Mínimo
              <Input
                id="residual-ymin"
                type="number"
                step="any"
                placeholder="auto"
                className="h-8 text-xs"
                value={residualYMin}
                onChange={(event) => setResidualYMin(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground" htmlFor="residual-ymax">
              Máximo
              <Input
                id="residual-ymax"
                type="number"
                step="any"
                placeholder="auto"
                className="h-8 text-xs"
                value={residualYMax}
                onChange={(event) => setResidualYMax(event.target.value)}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">Deixe vazio para escala automática.</p>
        </div>
        <div className="space-y-2 border-t border-border px-4 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Exibir
          </div>
          <SettingSwitch
            label="Hastes até o zero"
            description="Linha de cada ponto até o resíduo nulo"
            value={residualStems}
            onChange={setResidualStems}
          />
          <SettingSwitch
            label="Faixa ±σ"
            description={hasSigma ? "Incerteza média das medidas" : needsSigma}
            disabled={!hasSigma}
            value={residualBand && hasSigma}
            onChange={setResidualBand}
          />
          <SettingSwitch
            label="Barras de incerteza"
            description={hasSigma ? "σ de cada ponto" : needsSigma}
            disabled={!hasSigma}
            value={residualErrorBars && hasSigma}
            onChange={setResidualErrorBars}
          />
          <SettingSwitch
            label="Histograma lateral"
            description="Distribuição dos resíduos"
            value={residualHistogram}
            onChange={setResidualHistogram}
          />
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          Vale para todos os conjuntos.
          <button
            type="button"
            onClick={restore}
            className="text-foreground underline underline-offset-2"
          >
            Restaurar padrão
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
