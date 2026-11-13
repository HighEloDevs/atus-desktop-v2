/**
 * @module
 * Residuals panel drawn under the main chart, sharing its X scale.
 */

import { scaleLinear } from "d3";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    <div className="flex min-h-0 flex-[32_1_0%]">
      <div className="flex w-16 shrink-0 items-center justify-center text-[11px] text-muted-foreground">
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
              <path d={`M0 0V${h}H${w}`} fill="none" stroke="#aebbb0" />
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
                <line
                  x1={0}
                  x2={w}
                  y1={y(0)}
                  y2={y(0)}
                  stroke="#20272c"
                  strokeWidth="1.1"
                  opacity="0.7"
                />
                {visible.map((item) => (
                  <g
                    key={item.id}
                    opacity={highlightedSeriesId && highlightedSeriesId !== item.id ? 0.15 : 1}
                  >
                    {(item.residuals ?? [])
                      .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.residual))
                      .filter(inside)
                      .map((r, index) => (
                        <g key={`${r.x}-${r.residual}`}>
                          {residualStems && (
                            <line
                              data-testid="residual-stem"
                              className="residual-stem"
                              x1={x(r.x)}
                              x2={x(r.x)}
                              y1={y(0)}
                              y2={y(r.residual)}
                              stroke={item.color}
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              opacity="0.35"
                              style={
                                {
                                  "--length": Math.abs(y(r.residual) - y(0)) + 0.5,
                                  animationDelay: `${120 + index * 45}ms`,
                                } as CSSProperties
                              }
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
                            r={4.2}
                            fill={item.color}
                            className="residual-point"
                            style={{ animationDelay: `${260 + index * 45}ms` }}
                          >
                            <title>{`x = ${formatTick(r.x)}; resíduo = ${formatTick(r.residual)}`}</title>
                          </circle>
                        </g>
                      ))}
                  </g>
                ))}
              </g>
              {residualBand && sigma !== null && y(sigma) > 12 && (
                <text x={w - 6} y={y(sigma) - 5} textAnchor="end" fontSize="10" fill="#78857d">
                  ±σ
                </text>
              )}
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
                  <text x={histogramX} y={h + 16} fontSize="10" fill="#78857d">
                    distr.
                  </text>
                </g>
              )}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}

const ICONS = {
  stems: (
    <>
      <path d="M3 15h18" opacity=".5" />
      <path d="M7 15V8M12 15v4M17 15V6" />
    </>
  ),
  band: (
    <>
      <rect
        x="3"
        y="9"
        width="18"
        height="6"
        rx="1.5"
        opacity=".35"
        fill="currentColor"
        stroke="none"
      />
      <path d="M3 12h18" />
    </>
  ),
  errorBars: (
    <>
      <path d="M12 5v14M9 5h6M9 19h6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </>
  ),
  histogram: <path d="M5 6h6M5 10h12M5 14h9M5 18h4" />,
};

/**
 * One option row of the residuals menu: icon tile, title, description and a switch.
 * @param props - Icon, texts, current value, change callback, and optional disabled state.
 * @returns The rendered React element.
 */
function OptionRow({
  icon,
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  icon: keyof typeof ICONS;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onChange(!value);
      }}
      className={`grid w-full grid-cols-[26px_1fr_auto] items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-brand-coral ${disabled ? "cursor-not-allowed opacity-55 hover:bg-transparent" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-[26px] place-items-center rounded-md ${value ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          {ICONS[icon]}
        </svg>
      </span>
      <span className="min-w-0">
        <b className="block text-xs font-medium">{title}</b>
        <small className="mt-px block text-[11px] text-muted-foreground">{description}</small>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-0.5 transition-colors ${value ? "bg-foreground" : "bg-muted ring-1 ring-inset ring-border"}`}
      >
        <span
          className={`size-3.5 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-3" : ""}`}
        />
      </span>
    </button>
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
  const section = "border-t border-border px-4 py-3";
  const heading =
    "mb-2.5 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Opções do painel de resíduos"
          title="Opções do painel de resíduos"
          className="grid size-[30px] place-items-center rounded-lg border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand-coral data-[state=open]:bg-muted"
        >
          <SlidersHorizontal size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[316px] rounded-[14px] p-0">
        <header className="flex items-center justify-between py-3 pl-4 pr-3.5">
          <h2 className="text-[13px] font-semibold">Painel de resíduos</h2>
          <PopoverClose
            aria-label="Fechar"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand-coral"
          >
            <X size={15} />
          </PopoverClose>
        </header>
        <div className={section}>
          <h3 className={heading}>
            Escala Y
            <span className="rounded-full bg-muted px-[7px] py-0.5 font-mono text-[10.5px] font-medium normal-case tracking-normal text-foreground">
              {manual ? "manual" : "automática"}
            </span>
          </h3>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="grid gap-1 text-[11px] text-muted-foreground" htmlFor="residual-ymin">
              Mínimo
              <Input
                id="residual-ymin"
                type="number"
                step="any"
                placeholder="auto"
                className="h-8 font-mono text-xs"
                value={residualYMin}
                onChange={(event) => setResidualYMin(event.target.value)}
              />
            </label>
            <span aria-hidden="true" className="pb-[9px] text-muted-foreground">
              –
            </span>
            <label className="grid gap-1 text-[11px] text-muted-foreground" htmlFor="residual-ymax">
              Máximo
              <Input
                id="residual-ymax"
                type="number"
                step="any"
                placeholder="auto"
                className="h-8 font-mono text-xs"
                value={residualYMax}
                onChange={(event) => setResidualYMax(event.target.value)}
              />
            </label>
          </div>
          <p className="mt-2 flex justify-between gap-2 text-[11.5px] text-muted-foreground">
            <span>Deixe vazio para escala automática.</span>
            {manual && (
              <button
                type="button"
                onClick={() => {
                  setResidualYMin("");
                  setResidualYMax("");
                }}
                className="text-foreground underline underline-offset-2"
              >
                Limpar
              </button>
            )}
          </p>
        </div>
        <div className={section}>
          <h3 className={heading}>Exibir</h3>
          <div className="-mx-2 grid gap-0.5">
            <OptionRow
              icon="stems"
              title="Hastes até o zero"
              description="Linha de cada ponto até o resíduo nulo"
              value={residualStems}
              onChange={setResidualStems}
            />
            <OptionRow
              icon="band"
              title="Faixa ±σ"
              description={hasSigma ? "Incerteza média das medidas" : needsSigma}
              disabled={!hasSigma}
              value={residualBand && hasSigma}
              onChange={setResidualBand}
            />
            <OptionRow
              icon="errorBars"
              title="Barras de incerteza"
              description={hasSigma ? "σ de cada ponto" : needsSigma}
              disabled={!hasSigma}
              value={residualErrorBars && hasSigma}
              onChange={setResidualErrorBars}
            />
            <OptionRow
              icon="histogram"
              title="Histograma lateral"
              description="Distribuição dos resíduos"
              value={residualHistogram}
              onChange={setResidualHistogram}
            />
          </div>
        </div>
        <footer className="flex items-center justify-between border-t border-border px-4 pb-3.5 pt-2.5 text-[11px] text-muted-foreground">
          Vale para todos os conjuntos.
          <button
            type="button"
            onClick={restore}
            className="text-foreground underline underline-offset-2"
          >
            Restaurar padrão
          </button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
