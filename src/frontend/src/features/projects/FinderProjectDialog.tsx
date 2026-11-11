/**
 * @module
 * Confirmation when opening a Finder project over an active analysis.
 */

import { Dialog } from "radix-ui";
import { Button } from "../../components/ui/button";
import { fileName } from "./project-client";
import { ProjectFilePath } from "./ProjectFilePath";

type FinderProjectDialogProps = {
  path: string | null;
  opening: boolean;
  onCancel: () => void;
  onOpen: (path: string) => void;
};

/**
 * Confirms replacing the current analysis with a Finder request.
 * @param props - Requested path, opening state, and cancel and open callbacks.
 * @returns The rendered React element.
 */
export function FinderProjectDialog({ path, opening, onCancel, onOpen }: FinderProjectDialogProps) {
  return (
    <Dialog.Root
      open={path !== null}
      onOpenChange={(open) => {
        if (!open && !opening) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#20272c]/35 backdrop-blur-sm" />
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
          <Dialog.Title className="text-base font-semibold">Abrir outro projeto?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {path ? `Abrir ${fileName(path)} no lugar do projeto atual?` : ""}
          </Dialog.Description>
          {path && <ProjectFilePath path={path} />}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button size="sm" variant="ghost" disabled={opening}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button size="sm" disabled={opening} onClick={() => path && onOpen(path)}>
              {opening ? "Abrindo…" : "Abrir projeto"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
