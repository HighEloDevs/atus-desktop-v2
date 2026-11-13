/**
 * @module
 * Visual body of a snackbar: severity icon, title, description, actions, close button and timer bar.
 */

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { cn } from "cn";
import type { ReactNode } from "react";

/** Severity of a snackbar. `loading` is an in-progress state that never expires by itself. */
export type ToastKind = "success" | "error" | "warning" | "info" | "loading";

/** Visual treatment: dark `solid` card or `tinted` card coloured by severity. */
export type ToastVariant = "solid" | "tinted";

/** A button shown inside a snackbar. */
export interface ToastAction {
  /** Visible label. */
  label: string;
  /** Called when the button is pressed; the snackbar closes afterwards. */
  onClick?: () => void;
}

/** Props of {@link ToastView}. */
export interface ToastViewProps {
  kind: ToastKind;
  variant: ToastVariant;
  title: ReactNode;
  description?: ReactNode;
  actions?: ToastAction[];
  /** Total lifetime in milliseconds; the timer bar is hidden when `undefined`. */
  timerMs?: number;
  /** Changing this restarts the timer bar (used when a toast is updated in place). */
  timerKey?: number;
  /** Shows the close button. */
  closable: boolean;
  /** Closes the snackbar. */
  onClose: () => void;
}

const ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  loading: LoaderCircle,
} as const;

const SOLID_ICON = {
  success: "text-[#46c98a]",
  error: "text-[#ff7a5f]",
  warning: "text-[#f0b44a]",
  info: "text-[#8e9bff]",
  loading: "text-[#b8c0c5]",
} as const;

const TINTED = {
  success: "border-success bg-[#e6f3ec] text-success",
  error: "border-destructive bg-[#fce6e0] text-destructive",
  warning: "border-warning bg-[#fbf0d8] text-warning",
  info: "border-info bg-[#e8ebff] text-info",
  loading: "border-border bg-muted text-foreground",
} as const;

/**
 * Renders the content of one snackbar. Errors use `role="alert"`; the other kinds use `role="status"`.
 *
 * @param props - Content, appearance and callbacks of the snackbar.
 * @returns The rendered React element.
 */
export function ToastView(props: ToastViewProps) {
  const { kind, variant, title, description, actions, timerMs, timerKey, closable, onClose } =
    props;
  const Icon = ICONS[kind];
  const solid = variant === "solid";
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      data-kind={kind}
      data-variant={variant}
      className={cn(
        "relative grid w-[min(380px,calc(100vw-24px))] grid-cols-[auto_1fr_auto] items-start gap-x-2.5 gap-y-0.5 overflow-hidden rounded-lg border px-3.5 py-3 text-sm shadow-lg",
        solid ? "border-white/10 bg-foreground text-background" : TINTED[kind],
        timerMs !== undefined && "pb-4",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "row-span-2 mt-0.5 size-[18px]",
          solid && SOLID_ICON[kind],
          kind === "loading" && "animate-spin",
        )}
      />
      <p className="font-semibold leading-snug">{title}</p>
      {closable ? (
        <button
          type="button"
          aria-label="Fechar alerta"
          onClick={onClose}
          className="-mr-1 -mt-0.5 rounded p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-coral"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : (
        <span />
      )}
      {description ? (
        <p
          className={cn(
            "col-start-2 text-xs leading-snug",
            solid ? "text-[#b8c0c5]" : "opacity-85",
          )}
        >
          {description}
        </p>
      ) : null}
      {actions?.length ? (
        <div className="col-span-2 col-start-2 mt-2 flex flex-wrap gap-1.5">
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                action.onClick?.();
                onClose();
              }}
              className={cn(
                "rounded border px-2.5 py-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-brand-coral",
                index === 0 && actions.length > 1
                  ? "border-brand-coral bg-brand-coral text-foreground"
                  : "border-current",
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {timerMs !== undefined ? (
        <div
          key={timerKey}
          data-testid="toast-timer"
          aria-hidden="true"
          className="toast-timer absolute bottom-0 left-0 h-[3px] w-full bg-current opacity-40"
          style={{ "--toast-duration": `${timerMs}ms` } as React.CSSProperties}
        />
      ) : null}
    </div>
  );
}
