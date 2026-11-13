/**
 * @module
 * Chart image export controls: a split button that copies the image in one click and a menu
 * with the other destinations.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown, Copy, FileImage, LoaderCircle } from "lucide-react";
import { cn } from "cn";
import { notify } from "@/lib/notify";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyImage, errorMessage, renderImage, saveImage, type ImageFormat } from "./export-image";

type Action = "copy" | ImageFormat;
/** Snackbar id shared by every export result, so a new result replaces the previous one. */
const NOTICE_ID = "chart-export";

const BUSY_LABEL: Record<Action, string> = {
  copy: "Copiando…",
  png: "Salvando PNG…",
  jpeg: "Salvando JPEG…",
};
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const COPY_SHORTCUT = isMac ? "⇧⌘C" : "Ctrl+Shift+C";

/**
 * Renders controls to export the referenced chart as an image.
 *
 * The main button copies the image to the clipboard; the arrow opens a menu to copy or save as
 * PNG or JPEG. `Cmd/Ctrl+Shift+C` copies too. Results and errors appear in the global snackbar (`notify`).
 * @param props - Chart element ref and whether there is nothing to export yet.
 * @returns The rendered React element.
 */
export function ChartExportMenu({
  graphic,
  disabled,
}: {
  graphic: RefObject<HTMLDivElement | null>;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const running = useRef(false);

  async function run(action: Action) {
    const element = graphic.current;
    if (!element || running.current) return;
    running.current = true;
    setBusy(action);
    try {
      if (action === "copy") {
        await copyImage(await renderImage(element, "png"));
        notify.success("Imagem copiada", { id: NOTICE_ID });
      } else {
        const path = await saveImage(await renderImage(element, action), action);
        if (path) notify.success("Imagem salva", { id: NOTICE_ID, description: path });
        else notify.info("Exportação cancelada", { id: NOTICE_ID });
      }
    } catch (error) {
      notify.error("Não foi possível exportar", {
        id: NOTICE_ID,
        description: errorMessage(error),
        actions: [{ label: "Tentar de novo", onClick: () => void latestRun.current(action) }],
      });
    } finally {
      running.current = false;
      setBusy(null);
    }
  }

  // The shortcut listener is bound once per `disabled` change but must call the latest `run`.
  const latestRun = useRef(run);
  useEffect(() => {
    latestRun.current = run;
  });

  useEffect(() => {
    if (disabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const modifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (modifier && event.shiftKey && !event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void latestRun.current("copy");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled]);

  const inactive = disabled || busy !== null;
  const segment =
    "inline-flex h-8 items-center gap-2 text-xs text-white outline-none transition-colors hover:bg-[#313b42] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#364cff] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent";

  return (
    <div className="ml-auto flex items-center">
      <div className="inline-flex rounded-md border border-[#20272c] bg-[#20272c]">
        <button
          type="button"
          className={cn(segment, "rounded-l-[5px] px-3 font-medium")}
          title={`Copiar imagem (${COPY_SHORTCUT})`}
          disabled={inactive}
          onClick={() => void run("copy")}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Copy className="size-4" />}
          {busy ? BUSY_LABEL[busy] : "Copiar imagem"}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mais opções de exportação"
              className={cn(segment, "rounded-r-[5px] border-l border-white/25 px-2")}
              disabled={inactive}
            >
              <ChevronDown className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-1.5">
            <DropdownMenuLabel className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Copiar
            </DropdownMenuLabel>
            <DropdownMenuItem className="gap-2.5 px-2 py-2" onSelect={() => void run("copy")}>
              <ItemIcon />
              <Item title="Imagem" hint="Cola direto em Word, Slides…" />
              <kbd className="ml-auto rounded border border-border px-1.5 font-mono text-[11px] text-muted-foreground">
                {COPY_SHORTCUT}
              </kbd>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Salvar arquivo
            </DropdownMenuLabel>
            <DropdownMenuItem className="gap-2.5 px-2 py-2" onSelect={() => void run("png")}>
              <ItemIcon file />
              <Item title="PNG" hint="Alta qualidade, fundo branco" />
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 px-2 py-2" onSelect={() => void run("jpeg")}>
              <ItemIcon file />
              <Item title="JPEG" hint="Arquivo menor" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Square icon badge shown at the start of a menu item. */
function ItemIcon({ file }: { file?: boolean }) {
  const Icon = file ? FileImage : Copy;
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border text-[#364cff]">
      <Icon className="size-4" />
    </span>
  );
}

/** Two-line label for a menu item. */
function Item({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-xs font-medium">{title}</span>
      <span className="block text-[11px] text-muted-foreground">{hint}</span>
    </span>
  );
}
