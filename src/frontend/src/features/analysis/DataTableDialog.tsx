/**
 * @module
 * Read-only dialog that lists the points and uncertainties of a dataset.
 */

import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFullPrecision } from "@/lib/format-number";

/** One row of the table; uncertainties are optional. */
export type DataTablePoint = { x: number; y: number; sy?: number; sx?: number };

type DataTableDialogProps = {
  /** Dataset to show, or `null` to keep the dialog closed. */
  dataset: { name: string; points: DataTablePoint[] } | null;
  /** Called when the dialog asks to close (Esc, overlay click or the close button). */
  onClose: () => void;
};

const numberCell = "text-right font-mono text-[12.5px] tabular-nums";

/**
 * Renders a numeric cell with every digit that preserves the value, or an em dash when absent.
 * The full text is also the tooltip so it can be read and copied from any column width.
 */
function ValueCell({ value }: { value: number | undefined }) {
  if (value === undefined) {
    return <TableCell className={`${numberCell} text-[#a3ada6]`}>—</TableCell>;
  }
  const text = formatFullPrecision(value);
  return (
    <TableCell className={numberCell} title={text}>
      {text}
    </TableCell>
  );
}

/**
 * Read-only table of a dataset's points with a sticky header and the maximum number of digits.
 * The data cannot be edited here; to correct values, import again (Cmd/Ctrl+1–9 replaces the
 * data of the dataset).
 *
 * @param props - The dataset to show and the close handler.
 * @returns The rendered dialog, open while `dataset` is not `null`.
 */
export function DataTableDialog({ dataset, onClose }: DataTableDialogProps) {
  const count = dataset?.points.length ?? 0;
  return (
    <Dialog.Root open={dataset !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#20272c]/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] bg-white shadow-2xl">
          <header className="border-b border-border px-5 pb-3.5 pt-4">
            <div className="flex items-center gap-2">
              <Dialog.Title className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-.01em]">
                <span className="font-medium text-muted-foreground">Dados · </span>
                {dataset?.name}
              </Dialog.Title>
              <span className="rounded-full border border-border px-2 py-1 text-[11px] leading-none tabular-nums">
                {count} {count === 1 ? "ponto" : "pontos"}
              </span>
              <span className="rounded-full border border-border bg-[#eff2ed] px-2 py-1 text-[11px] leading-none text-muted-foreground">
                Somente leitura
              </span>
            </div>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              Pontos e incertezas do conjunto.
            </Dialog.Description>
          </header>
          {dataset && (
            <Table containerClassName="min-h-0 flex-1 overflow-auto" className="min-w-max">
              <TableHeader className="sticky top-0 z-10 bg-[#fafbf8] shadow-[0_1px_0_var(--color-border)] [&_tr]:border-b-0">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky left-0 z-20 w-14 bg-[#fafbf8] pl-5 text-[11px] uppercase tracking-[.04em] text-muted-foreground">
                    #
                  </TableHead>
                  {(["x", "y", "σy", "σx"] as const).map((label) => (
                    <TableHead
                      key={label}
                      className="px-4 text-right text-[11px] uppercase tracking-[.04em] text-muted-foreground"
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataset.points.map((point, index) => (
                  <TableRow key={index} className="group border-[#eef1ec] even:bg-[#fbfbf9]">
                    <TableCell className="sticky left-0 bg-white pl-5 text-xs text-muted-foreground group-even:bg-[#fbfbf9] group-hover:bg-[#eff2ed]">
                      {index + 1}
                    </TableCell>
                    <ValueCell value={point.x} />
                    <ValueCell value={point.y} />
                    <ValueCell value={point.sy} />
                    <ValueCell value={point.sx} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <footer className="flex items-center gap-3 border-t border-border px-5 py-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              Para corrigir valores, importe novamente: Cmd/Ctrl+1–9 substitui os dados do conjunto.
            </p>
            <Dialog.Close asChild>
              <Button type="button">Fechar</Button>
            </Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
