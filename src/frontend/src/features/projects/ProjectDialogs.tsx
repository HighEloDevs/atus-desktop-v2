/**
 * @module
 * Confirmation dialogs for renaming and deleting projects.
 */

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const overlay = "fixed inset-0 z-40 bg-[#20272c]/35 backdrop-blur-sm";
const content =
  "fixed left-1/2 top-1/2 z-50 w-[min(90vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-5 shadow-xl";

/**
 * Asks for a new project name. The parent remounts it (through `key`) for each project.
 * @param props - Current name, a submit callback that rejects with a readable message, and cancel.
 * @returns The rendered React element.
 */
export function RenameProjectDialog({
  name,
  onSubmit,
  onCancel,
}: {
  name: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onSubmit(value);
    } catch (reason) {
      setError(String(reason));
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content aria-modal="true" className={content}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Dialog.Title className="text-base font-semibold">Renomear projeto</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              O arquivo <span className="font-mono">{name}.atus</span> também será renomeado.
            </Dialog.Description>
            <Input
              autoFocus
              className="mt-4"
              aria-label="Novo nome"
              aria-invalid={error ? true : undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={(event) => event.target.select()}
            />
            {error && (
              <p role="alert" className="mt-2 text-[12px] text-[#a43d35]">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                Renomear
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Confirms moving a project to the system trash.
 * @param props - Project name, confirm callback and cancel callback.
 * @returns The rendered React element.
 */
export function DeleteProjectDialog({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content aria-modal="true" className={content}>
          <Dialog.Title className="text-base font-semibold">Excluir “{name}”?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            O arquivo será movido para a Lixeira do sistema e poderá ser restaurado de lá.
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[#a43d35] text-white hover:bg-[#8d332c]"
              onClick={onConfirm}
            >
              Mover para a Lixeira
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
