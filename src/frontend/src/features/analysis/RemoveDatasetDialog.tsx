/**
 * @module
 * Confirmation before removing a dataset that has several fits.
 */

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { equationToLatex } from "./fit/equation-to-latex";
import { FitLineSample } from "./fit/FitLineSample";
import type { LinePattern } from "./fit/dataset-fits";
import { Tex } from "./fit/Tex";

/** A fit listed in the confirmation. */
export type RemovedFit = {
  id: string;
  letter: string;
  label: string;
  equation: string;
  color: string;
  pattern: LinePattern;
};

/**
 * Asks before removing a dataset, listing the fits that go with it, so no fit disappears
 * without notice.
 * @param props - Dataset name, its fits, and the confirm and cancel callbacks.
 * @returns The rendered dialog.
 */
export function RemoveDatasetDialog({
  name,
  fits,
  onConfirm,
  onCancel,
}: {
  name: string;
  fits: RemovedFit[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#20272c]/45" />
        <Dialog.Content
          aria-modal="true"
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] bg-white p-5 shadow-2xl"
        >
          <Dialog.Title className="text-base font-semibold">Remover “{name}”?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Os pontos e os {fits.length} ajustes abaixo saem do projeto.
          </Dialog.Description>
          <ul className="mt-3 space-y-1.5 rounded-md border border-border px-3 py-2 text-[12px]">
            {fits.map((fit) => {
              const latex = fit.equation.trim() ? equationToLatex(fit.equation) : null;
              return (
                <li key={fit.id} className="flex min-w-0 items-center gap-2">
                  <FitLineSample color={fit.color} pattern={fit.pattern} />
                  <b className="font-mono">{fit.letter}</b>
                  <span className="min-w-0 truncate">
                    {fit.label ||
                      (latex ? (
                        <Tex latex={latex} />
                      ) : (
                        <span className="text-muted-foreground">Sem função</span>
                      ))}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={onConfirm}>
              Remover conjunto e ajustes
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
