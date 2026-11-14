/**
 * @module
 * The update button of the header: always in view while an update needs attention, hidden
 * while the app is up to date.
 */

import { ArrowUp, Download, ExternalLink, LoaderCircle, RotateCw } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUpdate } from "./update-context";
import { formatMegabytes, manualMessage, percent } from "./update-messages";

interface ActionProps {
  icon: ComponentType<{ "aria-hidden": true; className?: string }>;
  label: string;
  title?: string;
  compact: boolean;
  className?: string;
  variant?: "default" | "outline";
  spin?: boolean;
  /** Coral dot that marks an update waiting for a decision. */
  attention?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Extra content before the label, such as the progress ring. */
  leading?: ReactNode;
}

/** A button with an icon and a label; only the icon shows in the compact variant. */
function Action({
  icon: Icon,
  label,
  title,
  compact,
  className,
  variant = "outline",
  spin,
  attention,
  disabled,
  onClick,
  leading,
  ...rest
}: ActionProps & Record<string, unknown>) {
  return (
    <Button
      type="button"
      variant={variant}
      size={compact ? "icon-sm" : "sm"}
      className={cn("relative bg-card", variant === "default" && "bg-primary", className)}
      title={title ?? label}
      aria-label={compact ? label : undefined}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {leading ?? <Icon aria-hidden className={spin ? "animate-spin" : undefined} />}
      {compact ? null : label}
      {attention && (
        <span
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full bg-brand-coral",
            compact ? "absolute top-1 right-1 ring-2 ring-card" : "-ml-0.5",
          )}
        />
      )}
    </Button>
  );
}

/** A small ring that fills with the download progress. */
function ProgressRing({ value }: { value: number | null }) {
  const circumference = 2 * Math.PI * 5.5;
  return (
    <svg aria-hidden="true" viewBox="0 0 14 14" className="size-3.5 -rotate-90">
      <circle cx="7" cy="7" r="5.5" fill="none" strokeWidth="2.4" className="stroke-border" />
      <circle
        cx="7"
        cy="7"
        r="5.5"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        className={cn("stroke-foreground", value === null && "animate-spin origin-center")}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - (value ?? 25) / 100)}
      />
    </svg>
  );
}

/**
 * The update button.
 *
 * It follows the update state: hidden while there is nothing to do; **Baixar atualização** for an
 * announced update that is not downloading; the download progress with a way to cancel;
 * **Atualizar** (with a coral dot) once downloaded; **Instalando…**; **Tentar de novo** after a
 * failure; and **Baixar** with the reason when it must be installed by hand.
 *
 * @param props - `compact` shows only the icon, for tight toolbars; `className` adds classes.
 * @returns The button, or nothing when there is nothing to offer.
 */
export function UpdateButton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const update = useUpdate();
  const { state } = update;
  const shared = { compact, className };
  switch (state.kind) {
    case "available":
      return (
        <Action
          {...shared}
          icon={Download}
          label="Baixar atualização"
          title={`Baixar a versão ${state.version}`}
          onClick={() => void update.download()}
        />
      );
    case "downloading": {
      const value = percent(state.downloaded, state.total);
      const label = value === null ? "Baixando" : `Baixando ${value}%`;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Action
              {...shared}
              icon={Download}
              label={label}
              title={`Baixando a versão ${state.version}`}
              leading={<ProgressRing value={value} />}
              className={cn("tabular-nums", className)}
            />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-4">
            <p className="text-sm font-semibold">Baixando o ATUS {state.version}</p>
            <div
              role="progressbar"
              aria-label="Progresso do download"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value ?? undefined}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-foreground transition-[width]"
                style={{ width: `${value ?? 0}%` }}
              />
            </div>
            <p className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>
                {formatMegabytes(state.downloaded)}
                {state.total ? ` de ${formatMegabytes(state.total)}` : ""}
              </span>
              {value !== null && <span>{value}%</span>}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Você continua trabalhando. Quando terminar, o botão vira <b>Atualizar</b>.
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void update.cancelDownload()}
              >
                Cancelar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      );
    }
    case "ready":
      return (
        <Action
          {...shared}
          icon={ArrowUp}
          label="Atualizar"
          title={`Atualizar para a versão ${state.version}`}
          variant="default"
          className={cn("text-primary-foreground hover:bg-primary/90", className)}
          attention
          onClick={update.openDialog}
        />
      );
    case "installing":
      return <Action {...shared} icon={LoaderCircle} label="Instalando…" spin disabled />;
    case "error":
      return (
        <Action
          {...shared}
          icon={RotateCw}
          label="Tentar de novo"
          title={state.message}
          className={cn("border-destructive/40 text-destructive", className)}
          onClick={() => void update.retry()}
        />
      );
    case "manual":
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Action
              {...shared}
              icon={ExternalLink}
              label={`Baixar ${state.version}`}
              title={`Baixar a versão ${state.version}`}
              attention
            />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-4">
            <p className="text-sm font-semibold">ATUS {state.version}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {manualMessage(state.reason, state.version)}
            </p>
            <div className="mt-3 flex justify-end">
              <Button type="button" size="sm" onClick={() => void update.openReleases()}>
                <ExternalLink aria-hidden /> Baixar {state.version}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      );
    default:
      return null;
  }
}
