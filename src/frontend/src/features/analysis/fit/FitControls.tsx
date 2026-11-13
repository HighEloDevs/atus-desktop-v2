/**
 * @module
 * Controls for entering a model and fit configuration.
 */

import { useId } from "react";
import { ChevronRight, Lock, MoveHorizontal, MoveVertical, SlidersHorizontal } from "lucide-react";
import { EquationField } from "./EquationField";
import { resolveFitParameters } from "./parse-fit-parameters";
import { validateFitConfig, type FitConfig } from "./fit-config";

const field =
  "mt-2 h-9 w-full rounded-lg border border-input bg-white px-3 font-mono text-[13px] text-foreground shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";
const heading = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const description = "mt-1.5 text-[12px] leading-5 text-muted-foreground";

/**
 * Renders inputs for a series model and fit configuration.
 * @param props - Series name, fit configuration, and update callback.
 * @returns The rendered React element.
 */
export function FitControls({
  name,
  config,
  onChange,
}: {
  name: string;
  config: FitConfig;
  onChange: (changes: Partial<FitConfig>) => void;
}) {
  const equationId = useId();
  const parsedParameters = resolveFitParameters(config.parameters, config.equation);
  const parametersInvalid = !parsedParameters.ok;
  const parameters = parametersInvalid
    ? resolveFitParameters("", config.equation)
    : parsedParameters;
  const parametersErrorId = useId();
  const error = config.equation.trim() ? validateFitConfig(config) : null;
  return (
    <div className="text-[12px] text-foreground">
      <section className="pb-5">
        <h3 className={heading}>Modelo</h3>
        <label className="mt-3 block font-semibold" htmlFor={equationId}>
          Função de ajuste
        </label>
        <p className={description}>
          Define a função ajustada aos pontos deste conjunto. Deixe vazio para não ajustar.
        </p>
        <div className="mt-2">
          <EquationField
            id={equationId}
            label={`Função de ajuste de ${name}`}
            value={config.equation}
            onChange={(equation) => onChange({ equation })}
          />
        </div>
      </section>
      {config.equation.trim() && (
        <>
          <section className="border-t border-border py-5">
            <h3 className={heading}>Parâmetros</h3>
            <p className={description}>Valores iniciais e restrições para o algoritmo de ajuste.</p>
            <label className="mt-3 block font-semibold">
              Valores iniciais
              <input
                aria-label={`Parâmetros de ${name}`}
                value={config.parameters}
                onChange={(event) => onChange({ parameters: event.target.value })}
                placeholder="a=1; b=1"
                className={`${field} ${parametersInvalid ? "border-[#c13a32] ring-1 ring-[#c13a32] focus:border-[#c13a32] focus:ring-[#c13a32]/20" : ""}`}
                aria-invalid={parametersInvalid}
                aria-describedby={parametersInvalid ? parametersErrorId : undefined}
                spellCheck={false}
              />
            </label>
            {parametersInvalid && (
              <p
                id={parametersErrorId}
                role="alert"
                className="mt-1.5 text-[11px] font-medium text-[#a43d35]"
              >
                Expressão inválida. Confira os valores iniciais e as restrições.
              </p>
            )}
            {parameters.ok && parameters.parameters.length > 0 && (
              <div className="mt-2 rounded-lg border border-border bg-muted/50 p-2">
                <p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
                  Interpretação
                </p>
                <div className="space-y-1.5">
                  {parameters.parameters.map((p) => (
                    <div
                      key={p.name}
                      className="rounded-lg border border-border bg-white px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold">{p.name}</span>
                        <div className="flex items-center gap-1">
                          {p.source === "implicit" && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              padrão
                            </span>
                          )}
                          <span
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${p.vary ? "bg-brand-coral/15 text-foreground" : "bg-muted text-muted-foreground"}`}
                          >
                            {p.vary ? <SlidersHorizontal size={11} /> : <Lock size={11} />}
                            {p.vary ? "livre" : "fixo"}
                          </span>
                        </div>
                      </div>
                      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                        <dt className="text-muted-foreground">inicial</dt>
                        <dd className="font-mono">{p.value}</dd>
                        <dt className="text-muted-foreground">limites</dt>
                        <dd className="font-mono">
                          {p.min !== null && p.max !== null ? `${p.min} → ${p.max}` : "sem limites"}
                        </dd>
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Ex.: a=1; b=2. Fixe com $: b=$1. Limites: b=5[0, 10].
            </p>
          </section>
          <section className="border-t border-border py-5">
            <h3 className={heading}>Incertezas</h3>
            <p className={description}>
              Defina se os erros experimentais em cada eixo influenciam o peso dos pontos.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  {
                    axis: "X",
                    active: config.useSx,
                    Icon: MoveHorizontal,
                    toggle: () => onChange({ useSx: !config.useSx }),
                  },
                  {
                    axis: "Y",
                    active: config.useSy,
                    Icon: MoveVertical,
                    toggle: () => onChange({ useSy: !config.useSy }),
                  },
                ] as const
              ).map(({ axis, active, Icon, toggle }) => (
                <button
                  key={axis}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={toggle}
                  className={`flex min-w-0 items-center gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "border-brand-coral bg-brand-coral/10" : "border-input bg-white"}`}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-brand-coral/15 text-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      σ{axis.toLowerCase()}, eixo {axis}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {active ? "Considerada" : "Ignorada"}
                    </span>
                  </span>
                  <span
                    className={`size-2 shrink-0 rounded-full ${active ? "bg-brand-coral" : "bg-muted-foreground/40"}`}
                  />
                </button>
              ))}
            </div>
          </section>
          {error && !parametersInvalid && (
            <p role="alert" className="pb-3 text-[11px] text-[#a43d35]">
              {error}
            </p>
          )}
          <details className="group border-t border-border py-5">
            <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={15}
                className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
              />
              <span>
                <span className={heading}>Limitar intervalo em X</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Filtre quais pontos entram no ajuste.
                </span>
              </span>
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label>
                Mínimo
                <input
                  type="number"
                  step="any"
                  aria-label={`Mínimo de X para ${name}`}
                  value={config.minX}
                  onChange={(e) => onChange({ minX: e.target.value })}
                  placeholder="Automático"
                  className={field}
                />
              </label>
              <label>
                Máximo
                <input
                  type="number"
                  step="any"
                  aria-label={`Máximo de X para ${name}`}
                  value={config.maxX}
                  onChange={(e) => onChange({ maxX: e.target.value })}
                  placeholder="Automático"
                  className={field}
                />
              </label>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
