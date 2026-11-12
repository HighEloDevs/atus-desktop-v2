/**
 * @module
 * Dialog that lets the user pick a separator after an import could not be read.
 */

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "../../../components/ui/button";
import { SeparatorSelect } from "./SeparatorSelect";
import type { SeparatorType } from "./text-data-parser";

/**
 * Asks for a separator and retries the failed import.
 *
 * The parent should remount it (through `key`) for each pending import so the choice starts
 * from the current separator.
 *
 * @param props - Source name, last error, initial separator, and retry and cancel callbacks.
 * @returns The rendered React element.
 */
export function SeparatorDialog({
  name,
  error,
  initialSeparator,
  onRetry,
  onCancel,
}: {
  name: string;
  error: string;
  initialSeparator: SeparatorType;
  onRetry: (separator: SeparatorType) => void;
  onCancel: () => void;
}) {
  const [separator, setSeparator] = useState<SeparatorType>(initialSeparator);
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#20272c]/35 backdrop-blur-sm" />
        <Dialog.Content
          aria-modal="true"
          className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-white p-5 shadow-xl"
        >
          <Dialog.Title className="text-base font-semibold">Falha ao ler os dados</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Não foi possível identificar colunas numéricas em{" "}
            <span className="font-mono font-semibold text-foreground">{name}</span>. Escolha o
            caractere que separa as colunas. São aceitos y, pares x e y, e colunas com incertezas.
          </Dialog.Description>
          <p role="alert" className="mt-3 text-[12px] text-[#a43d35]">
            {error}
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            Separador
            <SeparatorSelect
              label="Separador para nova tentativa"
              value={separator}
              onChange={setSeparator}
              className="rounded border border-[#d8ded7] bg-white px-2 py-1 text-sm"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button size="sm" variant="ghost">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button size="sm" onClick={() => onRetry(separator)}>
              Tentar novamente
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
