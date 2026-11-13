/**
 * @module
 * Confirmation when a quick analysis arrives while another analysis is open.
 */

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";

type QuickAnalysisDialogProps = {
  /** Whether a quick analysis waits for confirmation. */
  open: boolean;
  /** True while the current project is saved and the new one created. */
  opening: boolean;
  /** Called when the person keeps the current analysis. */
  onCancel: () => void;
  /** Called when the person accepts opening the quick analysis. */
  onConfirm: () => void;
};

/**
 * Asks before replacing the open analysis with a new project made from the quick analysis. The
 * current project is saved first, so nothing is lost either way.
 *
 * @param props - Open and opening state, and the cancel and confirm callbacks.
 * @returns The rendered dialog.
 */
export function QuickAnalysisDialog({
  open,
  opening,
  onCancel,
  onConfirm,
}: QuickAnalysisDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !opening) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-sm" />
        <Dialog.Content
          aria-modal="true"
          className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-5 shadow-xl"
          onEscapeKeyDown={(event) => {
            if (opening) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (opening) event.preventDefault();
          }}
        >
          <Dialog.Title className="text-base font-semibold">Abrir a análise rápida?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            O projeto atual é salvo e fechado. A análise rápida abre num projeto novo, já com o
            ajuste executado.
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button size="sm" variant="ghost" disabled={opening}>
                Continuar aqui
              </Button>
            </Dialog.Close>
            <Button size="sm" disabled={opening} onClick={onConfirm}>
              {opening ? "Abrindo…" : "Abrir análise rápida"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
