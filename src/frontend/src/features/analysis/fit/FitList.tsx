/**
 * @module
 * Fit editor of one dataset in the analysis sidebar. With a single fit it is today's
 * `FitControls`, unchanged; with several it lists them, each identified by its line sample and
 * letter, and opens the controls of the active one (decision 0016).
 */

import { useId } from "react";
import { ChevronDown, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FitControls } from "./FitControls";
import { FitLineSample } from "./FitLineSample";
import { equationToLatex } from "./equation-to-latex";
import type { FitConfig } from "./fit-config";
import {
  describeRange,
  fitColor,
  fitLinePattern,
  type FitEntry,
  type LinePattern,
} from "./dataset-fits";
import { Tex } from "./Tex";

const heading = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

/** What the list needs from the dataset. */
export type FitListDataset = {
  id: string;
  name: string;
  color: string;
  lineStyle: LinePattern;
  fits: FitEntry[];
  activeFitId: string;
};

/**
 * Renders the fits of a dataset.
 * @param props - The dataset, and callbacks to activate a fit, change its configuration
 * (clears its result), change its label or visibility (keeps the result), add a fit by
 * duplicating the active one or blank, and remove a fit.
 * @returns The rendered React element.
 */
export function FitList({
  dataset,
  onActivate,
  onChange,
  onPatch,
  onAdd,
  onRemove,
}: {
  dataset: FitListDataset;
  onActivate: (fitId: string) => void;
  onChange: (fitId: string, changes: Partial<FitConfig>) => void;
  onPatch: (fitId: string, patch: Partial<Pick<FitEntry, "label" | "visible">>) => void;
  onAdd: (mode: "duplicate" | "blank") => void;
  onRemove: (fitId: string) => void;
}) {
  const labelId = useId();
  const { fits } = dataset;
  if (fits.length === 1)
    return (
      <FitControls
        name={dataset.name}
        config={fits[0]}
        onChange={(changes) => onChange(fits[0].id, changes)}
      />
    );
  const active = fits.find((fit) => fit.id === dataset.activeFitId) ?? fits[0];
  return (
    <div className="text-[12px] text-foreground">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={heading}>Ajustes · {fits.length}</h3>
        <div className="flex">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="rounded-r-none bg-white"
            onClick={() => onAdd("duplicate")}
            title={`Duplica o ajuste ${active.letter}`}
          >
            <Plus aria-hidden="true" /> Novo ajuste
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                className="-ml-px rounded-l-none bg-white"
                aria-label="Mais opções de novo ajuste"
              >
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => onAdd("duplicate")}>
                <Copy /> Duplicar ajuste {active.letter}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdd("blank")}>
                <Plus /> Ajuste em branco
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ol className="space-y-1" aria-label={`Ajustes de ${dataset.name}`}>
        {fits.map((fit) => {
          const open = fit.id === active.id;
          const color = fitColor(dataset.color, fit.letter);
          const latex = fit.equation.trim() ? equationToLatex(fit.equation) : null;
          const range = describeRange(fit);
          return (
            <li
              key={fit.id}
              className={`rounded-md border ${open ? "border-border bg-white" : "border-transparent"}`}
            >
              <div
                className={`flex items-center gap-1 rounded-md py-1 pl-2 pr-1 ${open ? "" : "hover:bg-[#e9ece7]"}`}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={`Ajuste ${fit.letter}${fit.label ? ` (${fit.label})` : ""}`}
                  onClick={() => onActivate(fit.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left ${fit.visible ? "" : "opacity-45"}`}
                >
                  <FitLineSample
                    color={color}
                    pattern={fitLinePattern(dataset.lineStyle, fit.letter)}
                  />
                  <span
                    className={`flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded px-1 font-mono text-[11px] font-semibold ${open ? "text-white" : "bg-[#e9ece7]"}`}
                    style={open ? { backgroundColor: dataset.color } : undefined}
                  >
                    {fit.letter}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {fit.label ? (
                      <span className="font-medium">{fit.label}</span>
                    ) : latex ? (
                      <Tex latex={latex} />
                    ) : (
                      <span className="text-muted-foreground">Sem função</span>
                    )}
                  </span>
                  {range !== "todos os pontos" && (
                    <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                      {range}
                    </span>
                  )}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-pressed={!fit.visible}
                  aria-label={`${fit.visible ? "Ocultar" : "Mostrar"} curva do ajuste ${fit.letter}`}
                  title={fit.visible ? "Ocultar curva" : "Mostrar curva"}
                  className="text-muted-foreground"
                  onClick={() => onPatch(fit.id, { visible: !fit.visible })}
                >
                  {fit.visible ? <Eye /> : <EyeOff />}
                </Button>
              </div>
              {open && (
                <div className="border-t border-border px-3 pb-1 pt-3">
                  <label htmlFor={labelId} className="block text-[12px] font-semibold">
                    Rótulo <span className="font-normal text-muted-foreground">(opcional)</span>
                  </label>
                  <input
                    id={labelId}
                    value={fit.label}
                    placeholder={`Ajuste ${fit.letter}`}
                    onChange={(event) => onPatch(fit.id, { label: event.target.value })}
                    className="mb-4 mt-2 h-8 w-full rounded-lg border border-input bg-white px-3 text-[12px] shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                  <FitControls
                    name={`${dataset.name}, ajuste ${fit.letter}`}
                    config={fit}
                    onChange={(changes) => onChange(fit.id, changes)}
                  />
                  <div className="flex justify-end gap-1 border-t border-border py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground"
                      onClick={() => onAdd("duplicate")}
                    >
                      <Copy aria-hidden="true" /> Duplicar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(fit.id)}
                    >
                      <Trash2 aria-hidden="true" /> Remover ajuste
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
