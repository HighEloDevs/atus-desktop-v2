/**
 * @module
 * Confirmation before installing a downloaded update.
 */

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { useUpdate } from "./update-context";

/**
 * Asks to install the downloaded update. Installing saves the open project, installs and
 * restarts the app, so the dialog says so; **Depois** keeps the update for later.
 *
 * @returns The dialog, open while the person is deciding about a downloaded update.
 */
export function UpdateDialog() {
  const { state, dialogOpen, closeDialog, install } = useUpdate();
  const version = state.kind === "ready" ? state.version : "";
  const notes = state.kind === "ready" ? state.notes : null;
  return (
    <Dialog.Root open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#20272c]/45" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-[10px] bg-white p-5 shadow-2xl">
          <Dialog.Title className="text-[17px] font-semibold tracking-[-.02em]">
            Atualizar para o ATUS {version}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            {notes ?? "Esta versão já foi baixada e está pronta para instalar."}
          </Dialog.Description>
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs leading-5 text-foreground">
            O ATUS salva o projeto aberto, instala a atualização e reinicia.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Depois
            </Button>
            <Button type="button" onClick={() => void install()}>
              Atualizar e reiniciar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
