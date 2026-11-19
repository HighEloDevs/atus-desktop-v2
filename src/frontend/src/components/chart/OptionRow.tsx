/**
 * @module
 * Switch row shared by the chart popovers: icon tile, title, optional description, switch.
 */

import type { ReactNode } from "react";

/**
 * One on/off option of a chart popover, styled with the general-control colors.
 * @param props - Icon paths (24×24 viewBox), title, optional description, current value,
 * change callback, and optional disabled state.
 * @returns The rendered React element.
 * @example
 * <OptionRow icon={<path d="M4 12h16" />} title="Grade principal" value onChange={setGrid} />
 */
export function OptionRow({
  icon,
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onChange(!value);
      }}
      className={`grid w-full grid-cols-[26px_1fr_auto] items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-brand-coral ${disabled ? "cursor-not-allowed opacity-55 hover:bg-transparent" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-[26px] place-items-center rounded-md ${value ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </span>
      <span className="min-w-0">
        <b className="block text-xs font-medium">{title}</b>
        {description && (
          <small className="mt-px block text-[11px] text-muted-foreground">{description}</small>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-0.5 transition-colors ${value ? "bg-foreground" : "bg-muted ring-1 ring-inset ring-border"}`}
      >
        <span
          className={`size-3.5 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-3" : ""}`}
        />
      </span>
    </button>
  );
}
