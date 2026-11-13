/**
 * @module
 * Global snackbar host built on Sonner. Mount {@link AppToaster} once at the application root.
 */

import { Toaster } from "sonner";

/** Where snackbars are anchored on screen. */
export type ToastPosition =
  "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

/** How concurrent snackbars are laid out: a `list`, an overlapping `stack`, or a single full-width `banner`. */
export type ToastMode = "list" | "stack" | "banner";

/** Props of {@link AppToaster}. */
export interface AppToasterProps {
  /** Layout of concurrent snackbars. Defaults to `list`. */
  mode?: ToastMode;
  /** Screen anchor. Defaults to `bottom-right`; `banner` forces a top/bottom edge. */
  position?: ToastPosition;
}

/**
 * Hosts every snackbar raised through `notify`. Rendering is delegated to each toast, so
 * Sonner provides only queueing, positioning, stacking and pausing.
 *
 * @param props - Optional layout mode and position.
 * @returns The rendered React element.
 * @example
 * <AppToaster mode="stack" position="top-right" />
 */
export function AppToaster({ mode = "list", position = "bottom-right" }: AppToasterProps) {
  const banner = mode === "banner";
  return (
    <Toaster
      position={banner ? (position.startsWith("top") ? "top-center" : "bottom-center") : position}
      expand={mode === "list"}
      visibleToasts={banner ? 1 : 4}
      gap={8}
      className="z-[60]"
      toastOptions={{ unstyled: true }}
      style={banner ? ({ "--width": "100vw" } as React.CSSProperties) : undefined}
    />
  );
}
