/**
 * @module
 * Typed facade over the global snackbar. Call `notify.error("Título", { description })` from any
 * component or hook; the {@link AppToaster} mounted at the root renders it.
 */

import { toast } from "sonner";
import {
  ToastView,
  type ToastAction,
  type ToastKind,
  type ToastVariant,
} from "@/components/ui/toast-view";

/** Lifetime in milliseconds by severity. Errors stay longer because they need reading and action. */
export const DEFAULT_DURATION_MS = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
} as const;

/** Options accepted by every `notify.*` call. */
export interface NotifyOptions {
  /** Second line with an explanation or how to fix the problem. */
  description?: string;
  /** Up to two buttons; the first is emphasised when there are two. */
  actions?: ToastAction[];
  /** Stable id: a call with an existing id updates that snackbar instead of adding another. */
  id?: string | number;
  /** Lifetime in milliseconds; `0` keeps the snackbar until it is closed. */
  duration?: number;
  /** Shows the shrinking timer bar. Defaults to `true` when the snackbar expires. */
  progress?: boolean;
  /** Visual treatment. Defaults to `solid`. */
  variant?: ToastVariant;
  /** Hides the close button. Defaults to `false`. */
  noClose?: boolean;
}

let timerCounter = 0;

function show(kind: ToastKind, title: string, options: NotifyOptions = {}): string | number {
  const duration =
    kind === "loading"
      ? 0
      : (options.duration ?? DEFAULT_DURATION_MS[kind as keyof typeof DEFAULT_DURATION_MS]);
  const persistent = duration === 0;
  const timerKey = ++timerCounter;
  const id = options.id ?? `notify-${timerKey}`;
  return toast.custom(
    (toastId) => (
      <ToastView
        kind={kind}
        variant={options.variant ?? "solid"}
        title={title}
        description={options.description}
        actions={options.actions?.slice(0, 2)}
        timerMs={!persistent && options.progress !== false ? duration : undefined}
        timerKey={timerKey}
        closable={!options.noClose}
        onClose={() => toast.dismiss(toastId)}
      />
    ),
    { id, duration: persistent ? Infinity : duration },
  );
}

/**
 * Global snackbar API.
 *
 * @example
 * notify.error("Arquivo grande demais", { description: "O limite é 1 MB." });
 * const id = notify.loading("Ajustando…");
 * notify.success("Ajuste concluído", { id });
 */
export const notify = {
  /** Shows a success snackbar and returns its id. */
  success: (title: string, options?: NotifyOptions) => show("success", title, options),
  /** Shows an error snackbar and returns its id. */
  error: (title: string, options?: NotifyOptions) => show("error", title, options),
  /** Shows a warning snackbar and returns its id. */
  warning: (title: string, options?: NotifyOptions) => show("warning", title, options),
  /** Shows an informational snackbar and returns its id. */
  info: (title: string, options?: NotifyOptions) => show("info", title, options),
  /** Shows a persistent in-progress snackbar; reuse the returned id to turn it into a result. */
  loading: (title: string, options?: NotifyOptions) => show("loading", title, options),
  /** Closes the snackbar with the given id, or every snackbar when omitted. */
  dismiss: (id?: string | number) => toast.dismiss(id),
};
