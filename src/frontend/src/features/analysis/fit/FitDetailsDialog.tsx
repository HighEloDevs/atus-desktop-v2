/**
 * @module
 * Detailed fit report: adjustment figures, parameters, residuals and matrices.
 */

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Copy } from "lucide-react";
import { notify } from "@/lib/notify";
import { equationToLatex } from "./equation-to-latex";
import { MatrixTable } from "./MatrixTable";
import { ResidualChart } from "./ResidualChart";
import type { ResultItem } from "./ResultsPanel";
import {
  COPY_SEPARATORS,
  correlationFromCovariance,
  formatSignificant,
  matrixToLatex,
  parameterToLatex,
  parametersToClipboardText,
  type CopyOptions,
} from "./result-format";
import { Tex } from "./Tex";

const selectClass = "rounded border border-border bg-white px-2 py-1 text-xs";

async function copyText(text: string, success: string) {
  try {
    await navigator.clipboard.writeText(text);
    notify.success(success);
  } catch {
    notify.error("Não foi possível copiar.");
  }
}

/**
 * Detailed report for one fit, in the order of the ATUS V1 report.
 *
 * Without point uncertainties the V1 shows the same number under another name
 * ("Somatória dos resíduos absolutos ao quadrado") and adds the uncertainty that
 * was considered. This dialog keeps that labelling.
 * @param props - The item to show (a fit with a result) and a close callback.
 * @returns The modal dialog.
 */
export function FitDetailsDialog({ item, onClose }: { item: ResultItem; onClose: () => void }) {
  const result = item.result;
  const [options, setOptions] = useState<CopyOptions>({
    separator: "Tabulação",
    decimal: "Ponto",
    header: true,
  });
  if (!result) return null;
  const names = result.parameters.map((p) => p.name);
  const correlation = correlationFromCovariance(result.covariance);
  const latex = equationToLatex(result.equation);
  const figures = result.hasUncertainty
    ? [
        ["NGL", String(result.degreesOfFreedom)],
        ["Chi²", formatSignificant(result.chiSquared, 6)],
      ]
    : [
        ["NGL", String(result.degreesOfFreedom)],
        ["Somatória dos resíduos absolutos ao quadrado", formatSignificant(result.chiSquared, 6)],
        ["Incerteza considerada", formatSignificant(result.uncertaintyUsed, 6)],
      ];
  const heading = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
  const small =
    "flex items-center gap-1 rounded border border-border bg-white px-2 py-1 text-xs hover:bg-muted";
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(94vw,700px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        >
          <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <Dialog.Title className="truncate text-sm font-semibold">{item.name}</Dialog.Title>
              </div>
              {latex && (
                <div className="mt-2 overflow-x-auto whitespace-nowrap rounded bg-muted/50 px-3 py-2 text-[17px]">
                  <Tex latex={`f(x) = ${latex}`} />
                </div>
              )}
            </div>
            <Dialog.Close className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">
              Fechar
            </Dialog.Close>
          </header>
          <div className="flex flex-col gap-6 overflow-y-auto px-5 pb-6 pt-4">
            <section aria-labelledby="fit-figures" className="flex flex-col gap-2.5">
              <h3 id="fit-figures" className={heading}>
                Ajuste
              </h3>
              <dl className="m-0 flex flex-wrap rounded-md border border-border bg-muted/50">
                {figures.map(([label, value], index) => (
                  <div
                    key={label}
                    className={`flex min-w-[150px] flex-1 flex-col gap-0.5 px-4 py-2.5 ${index ? "border-l border-border" : ""}`}
                  >
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="m-0 break-words font-mono text-xl tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {!result.hasUncertainty && (
                <p className="text-xs text-muted-foreground">
                  Os pontos não têm incerteza. As incertezas dos parâmetros e a covariância já
                  incluem a incerteza considerada.
                </p>
              )}
            </section>

            <section aria-labelledby="fit-parameters" className="flex flex-col gap-2.5">
              <h3 id="fit-parameters" className={heading}>
                Parâmetros
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="border-b border-border px-3 py-2 font-semibold">Parâmetro</th>
                      <th className="border-b border-border px-3 py-2 text-right font-semibold">
                        Valor
                      </th>
                      <th className="border-b border-border px-3 py-2 text-right font-semibold">
                        Incerteza
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.parameters.map((p) => (
                      <tr key={p.name}>
                        <td className="border-b border-border px-3 py-2.5">
                          <Tex latex={parameterToLatex(p.name)} />
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-right font-mono tabular-nums">
                          {formatSignificant(p.value, 6)}
                        </td>
                        <td className="border-b border-border px-3 py-2.5 text-right font-mono tabular-nums">
                          {formatSignificant(p.uncertainty, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                <label htmlFor="copy-separator">Separador</label>
                <select
                  id="copy-separator"
                  className={selectClass}
                  value={options.separator}
                  onChange={(event) =>
                    setOptions({
                      ...options,
                      separator: event.target.value as CopyOptions["separator"],
                    })
                  }
                >
                  {Object.keys(COPY_SEPARATORS).map((key) => (
                    <option key={key}>{key}</option>
                  ))}
                </select>
                <label htmlFor="copy-decimal">Decimal</label>
                <select
                  id="copy-decimal"
                  className={selectClass}
                  value={options.decimal}
                  onChange={(event) =>
                    setOptions({
                      ...options,
                      decimal: event.target.value as CopyOptions["decimal"],
                    })
                  }
                >
                  <option>Ponto</option>
                  <option>Vírgula</option>
                </select>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={options.header}
                    onChange={(event) => setOptions({ ...options, header: event.target.checked })}
                  />
                  Cabeçalho
                </label>
                <button
                  type="button"
                  className={`${small} ml-auto text-foreground`}
                  onClick={() =>
                    void copyText(
                      parametersToClipboardText(result.parameters, options),
                      `Parâmetros de ${item.name} copiados.`,
                    )
                  }
                >
                  <Copy size={12} /> Copiar parâmetros
                </button>
              </div>
            </section>

            <section aria-labelledby="fit-residuals" className="flex flex-col gap-2.5">
              <h3 id="fit-residuals" className={heading}>
                Resíduos
              </h3>
              <div className="rounded-md border border-border px-2.5 pb-1 pt-2">
                <ResidualChart residuals={result.residuals} color={item.color} />
              </div>
            </section>

            <section aria-labelledby="fit-matrices" className="flex flex-col gap-2.5">
              <h3 id="fit-matrices" className={heading}>
                Matrizes
              </h3>
              <div
                className={`grid gap-4 ${names.length > 4 ? "grid-cols-1" : "grid-cols-[repeat(auto-fit,minmax(250px,1fr))]"}`}
              >
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <b className="text-[13px]">Correlação</b>
                    <button
                      type="button"
                      className={small}
                      onClick={() => void copyText(matrixToLatex(correlation, 3), "LaTeX copiado.")}
                    >
                      Copiar LaTeX
                    </button>
                  </div>
                  <MatrixTable
                    label="Matriz de correlação"
                    names={names}
                    values={correlation}
                    format={(v) => (Number.isFinite(v) ? v.toFixed(3).replace(".", ",") : "–")}
                    heat
                  />
                  <div
                    aria-hidden="true"
                    className="mt-2 flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
                  >
                    <span>−1</span>
                    <i
                      className="h-2 max-w-40 flex-1 rounded border border-border"
                      style={{ background: "linear-gradient(90deg,#f25a3c,#ffffff 50%,#364cff)" }}
                    />
                    <span>+1</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <b className="text-[13px]">Covariância</b>
                    <button
                      type="button"
                      className={small}
                      onClick={() =>
                        void copyText(matrixToLatex(result.covariance, 3), "LaTeX copiado.")
                      }
                    >
                      Copiar LaTeX
                    </button>
                  </div>
                  <MatrixTable
                    label="Matriz de covariância"
                    names={names}
                    values={result.covariance}
                    format={(v) => formatSignificant(v, 3)}
                  />
                </div>
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
