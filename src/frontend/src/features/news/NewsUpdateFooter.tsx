/**
 * @module
 * The part of the news page that says where the update is and lets the person install it.
 */

import { Check, ExternalLink, LoaderCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdate } from "@/features/updates/update-context";
import { manualMessage, percent } from "@/features/updates/update-messages";

/**
 * Update status and action for the foot of the version list. It mirrors the header button: install
 * a downloaded update, show the download, retry a failure or send the person to the download page.
 *
 * @param props - `installed`, the version running now.
 * @returns The status block.
 */
export function NewsUpdateFooter({ installed }: { installed: string }) {
  const update = useUpdate();
  const { state } = update;
  const note = (text: string) => <p className="text-xs leading-5 text-muted-foreground">{text}</p>;
  switch (state.kind) {
    case "ready":
      return (
        <>
          {note(`ATUS ${state.version} baixado e pronto.`)}
          <Button type="button" className="w-full" onClick={() => void update.install()}>
            Atualizar e reiniciar
          </Button>
        </>
      );
    case "available":
      return (
        <>
          {note(`ATUS ${state.version} disponível.`)}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void update.download()}
          >
            Baixar atualização
          </Button>
        </>
      );
    case "downloading": {
      const value = percent(state.downloaded, state.total);
      return (
        <>
          {note(`Baixando o ATUS ${state.version}${value === null ? "" : ` · ${value}%`}`)}
          <Button type="button" className="w-full" disabled>
            Atualizar e reiniciar
          </Button>
        </>
      );
    }
    case "installing":
      return (
        <Button type="button" variant="outline" className="w-full" disabled>
          <LoaderCircle aria-hidden className="animate-spin" /> Instalando…
        </Button>
      );
    case "error":
      return (
        <>
          {note(state.message)}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void update.retry()}
          >
            <RotateCw aria-hidden /> Tentar de novo
          </Button>
        </>
      );
    case "manual":
      return (
        <>
          {note(manualMessage(state.reason, state.version))}
          <Button type="button" className="w-full" onClick={() => void update.openReleases()}>
            <ExternalLink aria-hidden /> Baixar {state.version}
          </Button>
        </>
      );
    default:
      return (
        <p className="flex items-center gap-2 text-xs font-semibold text-success">
          <Check aria-hidden size={14} /> Você está na versão {installed}
        </p>
      );
  }
}
