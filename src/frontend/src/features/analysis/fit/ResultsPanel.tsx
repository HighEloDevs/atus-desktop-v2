/**
 * @module
 * Compact fit result cards under the chart, with a link to the detailed report.
 */

import { useState } from "react";
import { Activity, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { equationToLatex } from "./equation-to-latex";
import { FitDetailsDialog } from "./FitDetailsDialog";
import type { FitResponse } from "./fit-service";
import {
  CARD_PARAMETER_LIMIT,
  parameterToLatex,
  roundToUncertainty,
  superscript,
} from "./result-format";
import { Tex } from "./Tex";

/** One dataset shown in the panel: a fit result, or the reason its fit failed. */
export type ResultItem = {
  id: string;
  name: string;
  color: string;
  /** Present when the fit succeeded. */
  result?: FitResponse;
  /** Reason shown in a red card when the fit failed. */
  error?: string;
};

function ParameterValue({ value, uncertainty }: { value: number; uncertainty: number }) {
  const rounded = roundToUncertainty(value, uncertainty);
  const body = (
    <>
      <b className="font-semibold">{rounded.value}</b>{" "}
      <span className="text-muted-foreground">±</span>{" "}
      <span className="text-muted-foreground">{rounded.uncertainty}</span>
    </>
  );
  return rounded.exponent ? (
    <span>
      ({body})<span className="text-muted-foreground">×10{superscript(rounded.exponent)}</span>
    </span>
  ) : (
    <span>{body}</span>
  );
}

/**
 * Renders one card per fit. A successful card shows the equation and the first
 * parameters; the detailed report opens from "Ver detalhes". A failed fit shows a
 * red card with the reason and no action.
 * @param props - Items to show and a callback for highlighting a series in the chart.
 * @returns The rendered React element.
 */
export function ResultsPanel({
  results,
  onHighlight,
}: {
  results: ResultItem[];
  onHighlight: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const details = results.find((item) => item.id === detailsId && item.result);
  return (
    <section
      className={`-mx-5 -mb-5 mt-3 flex shrink-0 flex-col border-t border-border bg-background ${open ? "h-[min(40vh,340px)]" : "h-12"}`}
      aria-label="Resultados da análise"
    >
      <button
        type="button"
        onClick={() => {
          onHighlight(null);
          setOpen(!open);
        }}
        aria-expanded={open}
        className="flex h-12 shrink-0 items-center gap-2 px-4 text-left hover:bg-muted/50"
      >
        <Activity size={17} className="text-muted-foreground" />
        <span className="flex-1 text-[13px] font-semibold">Resultados da análise</span>
        {!open && results.length > 0 && (
          <span className="text-[11px] text-muted-foreground">{results.length} ajuste(s)</span>
        )}
        {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>
      {open && (
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          {results.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[12px] text-muted-foreground">
              <Activity size={28} />
              <p>Nenhum ajuste calculado.</p>
              <p>Configure uma função e execute os ajustes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
              {results.map((item) => {
                const { result } = item;
                const latex = result ? equationToLatex(result.equation) : null;
                const hidden = result ? result.parameters.length - CARD_PARAMETER_LIMIT : 0;
                return (
                  <article
                    key={item.id}
                    onMouseEnter={() => onHighlight(item.id)}
                    onMouseLeave={() => onHighlight(null)}
                    onFocus={() => onHighlight(item.id)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) onHighlight(null);
                    }}
                    className={`group relative flex min-w-0 flex-col gap-3 rounded-[10px] border p-3.5 transition-[border-color,box-shadow] ${item.error ? "border-destructive bg-destructive/10" : "border-border bg-white hover:border-ring focus-within:border-ring hover:shadow-[0_6px_20px_-10px_rgba(54,76,255,0.55)]"}`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-[9px] shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <h4
                        className="truncate text-xs font-semibold text-muted-foreground"
                        title={item.name}
                      >
                        {item.name}
                      </h4>
                    </div>
                    {item.error ? (
                      <p role="alert" className="flex gap-2 text-[13px] text-destructive">
                        <b aria-hidden="true">✕</b>
                        <span>
                          <b>Falha no ajuste.</b> {item.error}
                        </span>
                      </p>
                    ) : (
                      result && (
                        <>
                          {latex && (
                            <div className="overflow-x-auto whitespace-nowrap pb-0.5 text-[17px]">
                              <Tex latex={`f(x) = ${latex}`} />
                            </div>
                          )}
                          <div className="grid gap-1.5 border-t border-border pt-2.5 text-[13px] tabular-nums">
                            {result.parameters.slice(0, CARD_PARAMETER_LIMIT).map((p) => (
                              <div
                                key={p.name}
                                className="grid grid-cols-[2.2em_1fr] items-baseline"
                              >
                                <Tex
                                  latex={parameterToLatex(p.name)}
                                  className="text-muted-foreground"
                                />
                                <ParameterValue value={p.value} uncertainty={p.uncertainty} />
                              </div>
                            ))}
                            {result.parameters.length === 0 && (
                              <span className="text-muted-foreground">Nenhum parâmetro livre</span>
                            )}
                            {hidden > 0 && (
                              <span className="pl-[2.2em] text-xs text-muted-foreground">
                                + {hidden} {hidden === 1 ? "parâmetro" : "parâmetros"}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setDetailsId(item.id)}
                            aria-label={`Ver detalhes de ${item.name}`}
                            className="mt-auto flex w-full items-center justify-between rounded-[7px] bg-muted px-2.5 py-1.5 text-xs font-semibold transition-colors after:absolute after:inset-0 after:rounded-[10px] group-hover:bg-ring group-hover:text-white focus-visible:bg-ring focus-visible:text-white"
                          >
                            Ver detalhes
                            <ArrowRight
                              aria-hidden="true"
                              size={13}
                              className="transition-transform group-hover:translate-x-0.5"
                            />
                          </button>
                        </>
                      )
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
      {details && <FitDetailsDialog item={details} onClose={() => setDetailsId(null)} />}
    </section>
  );
}
