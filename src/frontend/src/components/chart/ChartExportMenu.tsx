/**
 * @module
 * Chart image export controls.
 */

import { useState, type RefObject } from "react";
import { notify } from "@/lib/notify";
import html2canvas from "html2canvas";
import { ChevronDown, Copy, Download, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Renders controls to export the referenced chart as an image.
 * @param props - Chart element ref and export settings.
 * @returns The rendered React element.
 */
export function ChartExportMenu({
  graphic,
  disabled,
}: {
  graphic: RefObject<HTMLDivElement | null>;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function exportImage(type: "png" | "jpeg" | "copy") {
    if (!graphic.current || busy) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(graphic.current, { scale: 2, backgroundColor: "#ffffff" });
      if (type === "copy") {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob || !navigator.clipboard?.write) throw new Error();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        notify.success("Imagem copiada.");
      } else {
        const link = document.createElement("a");
        link.download = `grafico.${type}`;
        link.href = canvas.toDataURL(`image/${type}`);
        link.click();
        notify.success("Imagem exportada.");
      }
    } catch {
      notify.error("Não foi possível exportar ou copiar a imagem.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ml-auto flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled || busy}>
            <Download /> {busy ? "Exportando…" : "Exportar"} <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-1.5">
          <DropdownMenuLabel className="px-2 py-2 text-[10px] uppercase tracking-wide text-[#758078]">
            Exportar gráfico
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="items-start gap-3 px-2 py-3"
            onSelect={() => void exportImage("copy")}
          >
            <Copy className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-xs font-medium">Copiar para área de transferência</span>
              <span className="mt-1 block text-[11px] text-[#758078]">
                Cole a imagem em outro aplicativo
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="items-start gap-3 px-2 py-3"
            onSelect={() => void exportImage("png")}
          >
            <FileImage className="mt-0.5" />
            <span>
              <span className="block text-xs font-medium">Salvar como PNG</span>
              <span className="mt-1 block text-[11px] text-[#758078]">
                Imagem de alta qualidade
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="items-start gap-3 px-2 py-3"
            onSelect={() => void exportImage("jpeg")}
          >
            <FileImage className="mt-0.5" />
            <span>
              <span className="block text-xs font-medium">Salvar como JPEG</span>
              <span className="mt-1 block text-[11px] text-[#758078]">Imagem compactada</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
