/**
 * @module
 * Fit editor of one dataset in the analysis sidebar (decision 0016). With a single fit it is
 * today's `FitControls`. With several it is an index of rows separated by hairlines: a closed
 * row still shows the curve sample, letter, equation, range and status; at most one row is open
 * and every row may be closed. Rename, duplicate and remove live in each row's "⋯" menu, and a
 * new fit is added at the end of the list.
 */

import { useState } from "react";
import { ChevronRight, Eye, EyeOff, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FitControls } from "./FitControls";
import { FitLineSample } from "./FitLineSample";
import { equationToLatex } from "./equation-to-latex";
import type { FitConfig } from "./fit-config";
import { describeRange, fitLook, fitStatus, type FitEntry, type LinePattern } from "./dataset-fits";
import { Tex } from "./Tex";

/** What the list needs from the dataset. */
export type FitListDataset = {
  id: string;
  name: string;
  color: string;
  lineStyle: LinePattern;
  lineWidth: number;
  fits: FitEntry[];
  /** Fit in focus: the source of "Novo ajuste" and the fit whose residuals are drawn. */
  activeFitId: string;
};

/** CSS border style that echoes a line pattern, for the rule beside an open fit's controls. */
const GUTTER: Record<LinePattern, string> = {
  solid: "solid",
  dashed: "dashed",
  dotted: "dotted",
  dashdot: "dashed",
};

/**
 * Renders the fits of a dataset.
 * @param props - The dataset; the open fit (or `null` when all rows are closed) and the fit whose
 * range is being marked on the chart; callbacks to open or close a row, change a configuration
 * (clears its result), change a label or visibility (keeps the result), add a fit (a copy of
 * `sourceId`, by default the fit in focus, or a blank one), remove a fit, and toggle marking the range on the chart.
 * @returns The rendered React element.
 */
export function FitList({
  dataset,
  openFitId,
  markingFitId = null,
  onToggle,
  onChange,
  onPatch,
  onAdd,
  onRemove,
  onMarkRange,
}: {
  dataset: FitListDataset;
  openFitId: string | null;
  markingFitId?: string | null;
  onToggle: (fitId: string) => void;
  onChange: (fitId: string, changes: Partial<FitConfig>) => void;
  onPatch: (fitId: string, patch: Partial<Pick<FitEntry, "label" | "visible">>) => void;
  onAdd: (mode: "duplicate" | "blank", sourceId?: string) => void;
  onRemove: (fitId: string) => void;
  onMarkRange?: (fitId: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const { fits } = dataset;
  const rangeToggle = (fit: FitEntry) =>
    onMarkRange && { active: markingFitId === fit.id, onToggle: () => onMarkRange(fit.id) };
  if (fits.length === 1)
    return (
      <FitControls
        name={dataset.name}
        config={fits[0]}
        onChange={(changes) => onChange(fits[0].id, changes)}
        rangeOnChart={rangeToggle(fits[0])}
      />
    );
  const focus = fits.find((fit) => fit.id === dataset.activeFitId) ?? fits[0];
  return (
    <div className="-mx-3.5 -mb-3.5 text-[12px] text-foreground">
      <ul className="border-t border-border" aria-label={`Ajustes de ${dataset.name}`}>
        {fits.map((fit) => {
          const open = fit.id === openFitId;
          const { color, pattern } = fitLook(dataset, fit);
          const latex = fit.equation.trim() ? equationToLatex(fit.equation) : null;
          const range = describeRange(fit);
          const status = fitStatus(fit);
          const finishRename = (value: string | null) => {
            if (value !== null) onPatch(fit.id, { label: value.trim() });
            setRenamingId(null);
          };
          const sample = <FitLineSample color={color} pattern={pattern} />;
          const letter = (
            <span
              className={`flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded px-1 font-mono text-[11px] font-semibold ${open ? "text-white" : "bg-[#e9ece7] text-[#3a4540]"}`}
              style={open ? { backgroundColor: color } : undefined}
            >
              {fit.letter}
            </span>
          );
          return (
            <li key={fit.id} className="group/fit border-b border-border last:border-b-0">
              <div className="flex items-center">
                {renamingId === fit.id ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3.5 pr-1">
                    {sample}
                    {letter}
                    <input
                      autoFocus
                      defaultValue={fit.label}
                      placeholder={`Ajuste ${fit.letter}`}
                      aria-label={`Rótulo do ajuste ${fit.letter}`}
                      onBlur={(event) => finishRename(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") finishRename(event.currentTarget.value);
                        if (event.key === "Escape") finishRename(null);
                      }}
                      className="h-7 min-w-0 flex-1 rounded-md border border-ring bg-white px-2 text-[12px] font-semibold outline-none ring-2 ring-ring/20"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={`Ajuste ${fit.letter}${fit.label ? ` (${fit.label})` : ""}`}
                    onClick={() => onToggle(fit.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3.5 pr-1 text-left hover:bg-[#f1f3ef]"
                  >
                    <span
                      className={`flex min-w-0 flex-1 items-center gap-2 ${fit.visible ? "" : "opacity-45"}`}
                    >
                      {sample}
                      {letter}
                      <span className="min-w-0 flex-1 truncate">
                        {fit.label && <span className="mr-1.5 font-semibold">{fit.label}</span>}
                        {latex ? (
                          <Tex latex={latex} className={fit.label ? "text-muted-foreground" : ""} />
                        ) : (
                          !fit.label && <span className="text-muted-foreground">Sem função</span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
                      {range !== "todos os pontos" && (
                        <span className="rounded-full border border-border px-1.5 py-0.5">
                          {range}
                        </span>
                      )}
                      <span
                        className={
                          status.failed ? "font-sans font-semibold text-destructive" : undefined
                        }
                      >
                        {status.text}
                      </span>
                    </span>
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                    />
                  </button>
                )}
                <div className="flex shrink-0 pr-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-pressed={!fit.visible}
                    aria-label={`${fit.visible ? "Ocultar" : "Mostrar"} curva do ajuste ${fit.letter}`}
                    title={fit.visible ? "Ocultar curva" : "Mostrar curva"}
                    className={`text-muted-foreground ${fit.visible && !open ? "opacity-0 focus-visible:opacity-100 group-hover/fit:opacity-100" : ""}`}
                    onClick={() => onPatch(fit.id, { visible: !fit.visible })}
                  >
                    {fit.visible ? <Eye /> : <EyeOff />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Ações do ajuste ${fit.letter}`}
                        className="text-muted-foreground"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => setRenamingId(fit.id)}>
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onAdd("duplicate", fit.id)}>
                        Duplicar ajuste {fit.letter}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onRemove(fit.id)}>
                        Remover ajuste
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {open && (
                <div className="relative pb-4 pl-11 pr-3.5 pt-1">
                  <span
                    aria-hidden="true"
                    className="absolute bottom-4 left-[25px] top-0 border-l-2 opacity-55"
                    style={{ borderColor: color, borderLeftStyle: GUTTER[pattern] as "solid" }}
                  />
                  <FitControls
                    name={`${dataset.name}, ajuste ${fit.letter}`}
                    config={fit}
                    onChange={(changes) => onChange(fit.id, changes)}
                    rangeOnChart={rangeToggle(fit)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-0.5 border-t border-border py-1.5 pl-2.5 pr-1.5">
        <button
          type="button"
          onClick={() => onAdd("duplicate")}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left font-medium text-[#3a4540] hover:bg-[#f1f3ef]"
        >
          <Plus size={14} aria-hidden="true" className="w-6 text-muted-foreground" />
          Novo ajuste
          <span className="font-normal text-muted-foreground">duplica {focus.letter}</span>
        </button>
        <button
          type="button"
          onClick={() => onAdd("blank")}
          className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-[#f1f3ef] hover:text-foreground"
        >
          em branco
        </button>
      </div>
    </div>
  );
}
