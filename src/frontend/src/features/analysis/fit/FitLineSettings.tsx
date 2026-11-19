/**
 * @module
 * Curve appearance of each fit of a dataset with several fits (decision 0016), shown in the
 * Personalização tab in place of the dataset's single "Linha de ajuste" section.
 */

import { RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FitLineSample } from "./FitLineSample";
import { fitLook, type FitEntry, type LinePattern } from "./dataset-fits";

const PATTERN_NAMES: Record<LinePattern, string> = {
  solid: "Contínua",
  dashed: "Tracejada",
  dotted: "Pontilhada",
  dashdot: "Traço-ponto",
};

/** Fields of a fit that set how its curve is drawn. */
export type FitCurvePatch = Partial<Pick<FitEntry, "curveColor" | "curveStyle" | "curveWidth">>;

/**
 * Renders colour, pattern and width controls for every fit of a dataset. A fit starts with the
 * look derived from the dataset (colour shade and pattern by letter, dataset width); changing a
 * field stores it on the fit, and **Restaurar** brings back the derived look.
 * @param props - The dataset (colour, pattern, width and fits) and a callback that patches a
 * fit without touching its result.
 * @returns The rendered React element.
 */
export function FitLineSettings({
  dataset,
  onPatch,
}: {
  dataset: { color: string; lineStyle: LinePattern; lineWidth: number; fits: FitEntry[] };
  onPatch: (fitId: string, patch: FitCurvePatch) => void;
}) {
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="font-semibold">Linhas de ajuste</h3>
        <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">
          Cor, estilo e espessura de cada curva.
        </span>
      </div>
      <ul className="space-y-3">
        {dataset.fits.map((fit) => {
          const look = fitLook(dataset, fit);
          const name = `ajuste ${fit.letter}`;
          return (
            <li key={fit.id} role="group" aria-label={`Linha do ${name}`} className="space-y-1.5">
              <div className="flex min-h-6 items-center gap-2">
                <FitLineSample color={look.color} pattern={look.pattern} />
                <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded bg-muted px-1 font-mono text-[11px] font-semibold">
                  {fit.letter}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{fit.label}</span>
                {look.custom && (
                  <button
                    type="button"
                    onClick={() =>
                      onPatch(fit.id, {
                        curveColor: undefined,
                        curveStyle: undefined,
                        curveWidth: undefined,
                      })
                    }
                    aria-label={`Restaurar a linha do ${name}`}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    Restaurar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[auto_1fr_3.5rem] gap-1.5">
                <span className="flex h-8 items-center rounded-md border border-input bg-background px-1">
                  <Input
                    className="h-6 w-8 cursor-pointer border-0 p-0.5 shadow-none"
                    type="color"
                    aria-label={`Cor da linha do ${name}`}
                    value={look.color}
                    onChange={(e) => onPatch(fit.id, { curveColor: e.target.value })}
                  />
                </span>
                <NativeSelect
                  className="h-8 w-full text-xs"
                  aria-label={`Estilo da linha do ${name}`}
                  value={look.pattern}
                  onChange={(e) => onPatch(fit.id, { curveStyle: e.target.value as LinePattern })}
                >
                  {(Object.keys(PATTERN_NAMES) as LinePattern[]).map((pattern) => (
                    <NativeSelectOption key={pattern} value={pattern}>
                      {PATTERN_NAMES[pattern]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Input
                  className="h-8 w-full text-xs"
                  type="number"
                  min="1"
                  max="10"
                  aria-label={`Espessura da linha do ${name} (px)`}
                  title="Espessura (px)"
                  value={look.width}
                  onChange={(e) =>
                    onPatch(fit.id, {
                      curveWidth: Math.max(1, Math.min(10, Number(e.target.value))),
                    })
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
