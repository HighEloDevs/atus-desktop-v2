/**
 * @module
 * The announcement that appears at most once a day while an update waits.
 */

import { ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdate } from "./update-context";

/**
 * Banner for a downloaded update (with **Atualizar e reiniciar**) or one that must be installed
 * by hand (with **Baixar**). The once-a-day rule lives in the provider; the close button hides it
 * until the next day. The header button stays, so the update is never lost.
 *
 * @returns The banner, or nothing when it is not due.
 */
export function UpdateBanner() {
  const { state, bannerVisible, install, openReleases, dismissBanner } = useUpdate();
  if (!bannerVisible || (state.kind !== "ready" && state.kind !== "manual")) return null;
  const ready = state.kind === "ready";
  return (
    <div
      role="status"
      className="mx-4 mt-3 flex shrink-0 flex-wrap items-center gap-3 rounded-[10px] border border-border bg-card p-3 shadow-sm"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <ArrowUp size={18} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[10px] font-bold tracking-[.1em] text-destructive uppercase">
          Nova versão · {state.version}
        </p>
        <p className="text-sm font-semibold tracking-[-.01em]">
          {ready
            ? `O ATUS ${state.version} está pronto para instalar`
            : "Há uma nova versão do ATUS"}
        </p>
        <p className="text-xs text-muted-foreground">
          {state.notes ??
            (ready
              ? "A atualização já foi baixada."
              : "Esta instalação precisa ser atualizada manualmente.")}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {ready ? (
          <Button type="button" size="sm" onClick={() => void install()}>
            Atualizar e reiniciar
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void openReleases()}>
            Baixar
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar até amanhã"
          title="Fechar até amanhã"
          onClick={dismissBanner}
        >
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
