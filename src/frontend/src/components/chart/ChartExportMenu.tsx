/**
 * @module
 * Chart image export controls: a split button that copies the image in one click and a menu
 * with the other destinations.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { Check, ChevronDown, Copy, FileImage, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "cn";
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
type Notice = { kind: "ok" | "error"; text: string; retry?: Action };

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
 * PNG or JPEG. `Cmd/Ctrl+Shift+C` copies too. Results and errors appear in a status toast.
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function run(action: Action) {
    const element = graphic.current;
    if (!element || running.current) return;
    running.current = true;
    setBusy(action);
    clearTimeout(timer.current);
    setNotice(null);
    let next: Notice;
    try {
      if (action === "copy") {
        await copyImage(await renderImage(element, "png"));
        next = { kind: "ok", text: "Imagem copiada para a área de transferência." };
      } else {
        const path = await saveImage(await renderImage(element, action), action);
        next = path
          ? { kind: "ok", text: `Salvo em ${path}` }
          : { kind: "ok", text: "Exportação cancelada." };
      }
    } catch (error) {
      next = {
        kind: "error",
        text: `Não foi possível exportar: ${errorMessage(error)}`,
        retry: action,
      };
    }
    setNotice(next);
    timer.current = setTimeout(() => setNotice(null), next.kind === "error" ? 8000 : 3000);
    running.current = false;
    setBusy(null);
  }

  // The shortcut listener is bound once per `disabled` change but must call the latest `run`.
  const latestRun = useRef(run);
  useEffect(() => {
    latestRun.current = run;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

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
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
          !notice && "hidden",
        )}
      >
        {notice && (
          <div
            className={cn(
              "pointer-events-auto flex max-w-[90vw] items-center gap-2.5 rounded-lg border-l-4 bg-[#20272c] px-3.5 py-2.5 text-xs text-white shadow-lg",
              notice.kind === "error" ? "border-[#f25a3c]" : "border-[#4cc38a]",
            )}
          >
            {notice.kind === "error" ? (
              <TriangleAlert className="size-4 shrink-0" />
            ) : (
              <Check className="size-4 shrink-0" />
            )}
            <span>{notice.text}</span>
            {notice.retry && (
              <button
                type="button"
                className="rounded-md border border-white/35 px-2 py-0.5 outline-none hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-[#364cff]"
                onClick={() => void run(notice.retry!)}
              >
                Tentar de novo
              </button>
            )}
          </div>
        )}
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
