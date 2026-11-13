/**
 * @module
 * Presentation of simulated fit results.
 */

import { useState } from "react";
import { Activity, ChevronDown, ChevronUp, ChevronRight, Copy } from "lucide-react";
import { Dialog } from "radix-ui";
import { notify } from "@/lib/notify";
import type { FitResponse } from "./fit-service";

type ResultItem = { id: string; name: string; color: string; result: FitResponse };
const format = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value);

/**
 * Renders simulated fit results and their details.
 * @param props - Results and a callback for highlighting a selected series.
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
  const details = results.find((item) => item.id === detailsId);
  async function copy(item: ResultItem) {
    try {
      await navigator.clipboard.writeText(
        `SIMULAÇÃO — valores fictícios\n${item.result.parameters.map((p) => `${p.name} = ${p.value} ± ${p.uncertainty}`).join("\n")}`,
      );
      notify.success(`Parâmetros de ${item.name} copiados.`);
    } catch {
      notify.error("Não foi possível copiar os parâmetros.");
    }
  }
  return (
    <section
      className={`-mx-5 -mb-5 mt-3 flex shrink-0 flex-col border-t border-border bg-background ${open ? "h-[min(35vh,300px)]" : "h-12"}`}
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
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {results.map((item) => (
                  <article
                    key={item.id}
                    onMouseEnter={() => onHighlight(item.id)}
                    onMouseLeave={() => onHighlight(null)}
                    onFocus={() => onHighlight(item.id)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) onHighlight(null);
                    }}
                    className="relative rounded-lg border border-border bg-white p-3 pl-4 shadow-sm"
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
                      style={{ backgroundColor: item.color }}
                    />
                    <h4 className="truncate text-[12px] font-semibold">{item.name}</h4>
                    <p className="mt-2 text-[10px] font-semibold uppercase text-muted-foreground">
                      Equação
                    </p>
                    <p className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[12px]">
                      {item.result.equation}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Parâmetros simulados
                      </p>
                      <button
                        type="button"
                        onClick={() => void copy(item)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <Copy size={12} /> Copiar
                      </button>
                    </div>
                    <div className="mt-1 rounded bg-muted/40 p-2 font-mono text-[11px]">
                      {item.result.parameters.length
                        ? item.result.parameters.map((p) => (
                            <div key={p.name} className="flex justify-between gap-2">
                              <span>{p.name}</span>
                              <span>
                                {format(p.value)} ± {format(p.uncertainty)}
                              </span>
                            </div>
                          ))
                        : "Nenhum parâmetro"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailsId(item.id)}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded border border-border py-1.5 text-[11px] hover:bg-muted"
                    >
                      Ver detalhes <ChevronRight size={12} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <Dialog.Root
        open={!!details}
        onOpenChange={(value) => {
          if (!value) setDetailsId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(90vw,600px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <Dialog.Title className="text-sm font-semibold">
              Resultados detalhados: {details?.name}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-xs text-[#8a6a38]">
              Valores fictícios para demonstração. Nenhum ajuste científico foi executado.
            </Dialog.Description>
            {details && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded border border-border p-3">
                    χ² simulado{" "}
                    <strong className="mt-2 block font-mono">
                      {format(details.result.chiSquared)}
                    </strong>
                  </div>
                  <div className="rounded border border-border p-3">
                    Graus de liberdade simulados{" "}
                    <strong className="mt-2 block font-mono">
                      {details.result.degreesOfFreedom}
                    </strong>
                  </div>
                </div>
                <h3 className="mt-4 text-xs font-semibold">Parâmetros simulados</h3>
                <div className="mt-2 space-y-1 font-mono text-xs">
                  {details.result.parameters.map((p) => (
                    <p key={p.name}>
                      {p.name} = {format(p.value)} ± {format(p.uncertainty)}
                    </p>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Matrizes e intervalos de confiança estarão disponíveis com o motor científico.
                </p>
              </>
            )}
            <div className="mt-5 flex justify-end">
              <Dialog.Close className="rounded border border-border px-3 py-1.5 text-xs">
                Fechar
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
