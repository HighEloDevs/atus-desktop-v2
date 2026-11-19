/**
 * @module
 * Side-by-side comparison of the fits of one dataset (decision 0016). Shows only what the V1
 * report shows (decision 0009): equation, range, NGL, Chi² or the sum of squared residuals with
 * the uncertainty used, the free parameters and the residuals. There is no "best fit" mark.
 */

import { Fragment, type ReactNode } from "react";
import { scaleLinear } from "d3";
import { equationToLatex } from "./equation-to-latex";
import type { FitResponse } from "./fit-service";
import { FitLineSample } from "./FitLineSample";
import type { LinePattern, ParameterGroup } from "./dataset-fits";
import {
  formatSignificant,
  parameterToLatex,
  roundToUncertainty,
  superscript,
} from "./result-format";
import { Tex } from "./Tex";

/** One column of the comparison. */
export type ComparedFit = {
  /** Fit id inside the dataset, as used by `groups`. */
  fitId: string;
  /** Chart series id, for highlighting the curve. */
  seriesId: string;
  letter: string;
  label: string;
  color: string;
  pattern: LinePattern;
  equation: string;
  /** Description of the X range ("todos os pontos", "2 a 5"…). */
  range: string;
  result?: FitResponse;
  error?: string;
};

/** The fits of one dataset to compare. */
export type FitComparisonData = {
  datasetId: string;
  datasetName: string;
  fits: ComparedFit[];
  groups: ParameterGroup[];
};

const cell = "border-b border-border px-3 py-2 align-middle";
const rowHead = `${cell} w-[150px] whitespace-nowrap text-left text-[11.5px] font-medium text-muted-foreground`;

function Value({ value, uncertainty }: { value: number; uncertainty: number }) {
  const rounded = roundToUncertainty(value, uncertainty);
  const text = `${rounded.value} ± ${rounded.uncertainty}`;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {rounded.exponent ? `(${text})×10${superscript(rounded.exponent)}` : text}
    </span>
  );
}

/**
 * Residuals of one fit, small, on a vertical scale shared by every column so their sizes can be
 * compared at a glance.
 */
function MiniResiduals({ fit, limit }: { fit: ComparedFit; limit: number }) {
  const residuals = (fit.result?.residuals ?? []).filter(
    (r) => Number.isFinite(r.x) && Number.isFinite(r.residual),
  );
  if (!residuals.length) return <span className="text-muted-foreground">—</span>;
  const width = 168;
  const height = 54;
  const xs = residuals.map((r) => r.x);
  const x = scaleLinear()
    .domain([Math.min(...xs), Math.max(...xs)])
    .range([5, width - 5]);
  const y = scaleLinear()
    .domain([-limit, limit])
    .range([height - 4, 4]);
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`Resíduos do ajuste ${fit.letter}`}
      className="block rounded bg-[#f7f8f5]"
    >
      <line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke="#8b978f" strokeDasharray="2 3" />
      {residuals.map((r, index) => (
        <g key={index}>
          {r.sy ? (
            <line
              x1={x(r.x)}
              x2={x(r.x)}
              y1={y(r.residual - r.sy)}
              y2={y(r.residual + r.sy)}
              stroke={fit.color}
              strokeOpacity={0.45}
            />
          ) : null}
          <circle cx={x(r.x)} cy={y(r.residual)} r={2.2} fill={fit.color} />
        </g>
      ))}
    </svg>
  );
}

/**
 * Renders the comparison table of one dataset.
 * @param props - Fits to compare and a callback to highlight a curve in the chart.
 * @returns The rendered React element.
 */
export function FitComparison({
  data,
  onHighlight,
}: {
  data: FitComparisonData;
  onHighlight: (seriesId: string | null) => void;
}) {
  const { fits, groups } = data;
  const limit =
    Math.max(
      0,
      ...fits.flatMap((fit) =>
        (fit.result?.residuals ?? [])
          .filter((r) => Number.isFinite(r.residual))
          .map((r) => Math.abs(r.residual) + (r.sy ?? 0)),
      ),
    ) * 1.1 || 1;
  const anyChi = fits.some((fit) => fit.result?.hasUncertainty);
  const anySum = fits.some((fit) => fit.result && !fit.result.hasUncertainty);
  const hover = (fit: ComparedFit) => ({
    onMouseEnter: () => onHighlight(fit.seriesId),
    onMouseLeave: () => onHighlight(null),
  });
  const row = (label: string, render: (fit: ComparedFit) => ReactNode) => (
    <tr>
      <th scope="row" className={rowHead}>
        {label}
      </th>
      {fits.map((fit) => (
        <td key={fit.fitId} className={cell} {...hover(fit)}>
          {render(fit)}
        </td>
      ))}
    </tr>
  );
  const missing = (fit: ComparedFit) =>
    fit.error ? <span className="text-destructive">Falhou</span> : "—";
  return (
    <div className="overflow-x-auto rounded-[10px] border border-border bg-white">
      <table
        className="w-full min-w-[520px] border-collapse text-[12.5px]"
        aria-label={`Comparação dos ajustes de ${data.datasetName}`}
      >
        <thead>
          <tr className="bg-[#f4f6f3]">
            <th className={`${cell} text-left text-[11.5px] font-medium text-muted-foreground`}>
              {data.datasetName}
            </th>
            {fits.map((fit) => (
              <th key={fit.fitId} scope="col" className={`${cell} text-left`} {...hover(fit)}>
                <span className="flex items-center gap-2 font-semibold">
                  <FitLineSample color={fit.color} pattern={fit.pattern} />
                  <span className="font-mono">{fit.letter}</span>
                  {fit.label && <span className="font-medium">{fit.label}</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono text-[12px]">
          {row("Função", (fit) => {
            const latex = fit.equation.trim() ? equationToLatex(fit.equation) : null;
            return latex ? (
              <Tex latex={latex} className="font-sans text-[14px]" />
            ) : (
              <span className="font-sans text-muted-foreground">Sem função</span>
            );
          })}
          {row("Intervalo em X", (fit) => fit.range)}
          {row("NGL", (fit) => fit.result?.degreesOfFreedom ?? missing(fit))}
          {anyChi &&
            row("Chi²", (fit) =>
              fit.result?.hasUncertainty ? formatSignificant(fit.result.chiSquared) : missing(fit),
            )}
          {anySum &&
            row("Somatória dos resíduos absolutos ao quadrado", (fit) =>
              fit.result && !fit.result.hasUncertainty
                ? formatSignificant(fit.result.chiSquared)
                : missing(fit),
            )}
          {anySum &&
            row("Incerteza considerada", (fit) =>
              fit.result && !fit.result.hasUncertainty
                ? formatSignificant(fit.result.uncertaintyUsed)
                : missing(fit),
            )}
          {groups.map((group) => {
            const latex = equationToLatex(group.equation);
            return (
              <Fragment key={group.equation}>
                <tr className="bg-[#f7f8f5]">
                  <th
                    scope="rowgroup"
                    className={`${cell} text-left font-sans text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground`}
                  >
                    Parâmetros
                  </th>
                  <td colSpan={fits.length} className={`${cell} font-sans text-[13px]`}>
                    {latex ? <Tex latex={latex} /> : group.equation}
                    {group.fitIds.length > 1 && (
                      <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10.5px] text-muted-foreground">
                        mesma função em{" "}
                        {fits
                          .filter((fit) => group.fitIds.includes(fit.fitId))
                          .map((fit) => fit.letter)
                          .join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
                {group.parameters.map((name) => (
                  <tr key={name}>
                    <th scope="row" className={rowHead}>
                      <Tex latex={parameterToLatex(name)} />
                    </th>
                    {fits.map((fit) => {
                      const inGroup = group.fitIds.includes(fit.fitId);
                      const p = fit.result?.parameters.find((item) => item.name === name);
                      return (
                        <td key={fit.fitId} className={cell} {...hover(fit)}>
                          {!inGroup ? null : p ? (
                            <Value value={p.value} uncertainty={p.uncertainty} />
                          ) : (
                            missing(fit)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            );
          })}
          <tr>
            <th scope="row" className={`${rowHead} border-b-0`}>
              Resíduos
              <span className="mt-0.5 block font-mono text-[10px] font-normal">
                mesma escala: ±{formatSignificant(limit, 2)}
              </span>
            </th>
            {fits.map((fit) => (
              <td key={fit.fitId} className={`${cell} border-b-0`} {...hover(fit)}>
                <MiniResiduals fit={fit} limit={limit} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
