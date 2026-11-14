/**
 * @module
 * Form pieces shared by the chart popovers (axes and legend), in the residuals panel
 * style: header, tab list, uppercase sections, label/control rows, segmented choices,
 * steppers and inline errors.
 */

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { PopoverClose } from "@/components/ui/popover";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Classes of a popover section: top border and padding. */
export const sectionClass = "grid gap-2 border-t border-border px-4 py-3";
/** Classes of a section title: small uppercase muted text. */
export const headingClass =
  "mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";

/**
 * One form row: label on the left, a fixed control column on the right.
 * @param props - Label text, the control, and the id the label points to.
 * @returns The rendered React element.
 */
export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[minmax(0,1fr)_156px] items-center gap-2.5 text-xs">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="font-medium">
          {label}
        </label>
      ) : (
        <span className="font-medium">{label}</span>
      )}
      {children}
    </div>
  );
}

/**
 * Segmented single choice that fills the control column.
 * @param props - Accessible name, options, current value, and change callback.
 * @returns The rendered React element.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; name?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      disabled={disabled}
      spacing={0.5}
      className="w-full rounded-md bg-muted p-0.5"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.name}
          className="h-7 min-w-0 flex-1 rounded-[5px] px-1 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-brand-coral data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * Minus/value/plus control for a bounded integer setting.
 * @param props - Accessible name, value, bounds, shown text, change callback, and
 * disabled state.
 * @returns The rendered React element.
 */
export function Stepper({
  label,
  value,
  bounds,
  display,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  bounds: readonly [number, number];
  display?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const button =
    "grid h-full w-8 place-items-center text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-coral";
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-8 w-full items-stretch overflow-hidden rounded-md border border-input"
    >
      <button
        type="button"
        aria-label={`Diminuir ${label}`}
        className={button}
        disabled={disabled || value <= bounds[0]}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output
        aria-live="polite"
        className={`grid flex-1 place-items-center border-x border-input font-mono text-xs ${disabled ? "text-muted-foreground" : ""}`}
      >
        {display ?? value}
      </output>
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        className={button}
        disabled={disabled || value >= bounds[1]}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

/**
 * Inline validation message.
 * @param props - Message text.
 * @returns The rendered React element.
 */
export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[11.5px] text-destructive">
      {children}
    </p>
  );
}

/**
 * Popover header with the title and a close button.
 * @param props - Title text.
 * @returns The rendered React element.
 */
export function PopoverHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between py-3 pl-4 pr-3.5">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <PopoverClose
        aria-label="Fechar"
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand-coral"
      >
        <X size={15} />
      </PopoverClose>
    </header>
  );
}

/**
 * Underlined tab list of a popover; it must sit inside a `Tabs` root.
 * @param props - Tab values and labels, in order.
 * @returns The rendered React element.
 */
export function PopoverTabsList({ tabs }: { tabs: [string, string][] }) {
  return (
    <TabsList variant="line" className="relative z-10 h-auto w-full justify-start gap-4 px-4 pb-0">
      {tabs.map(([value, label]) => (
        <TabsTrigger
          key={value}
          value={value}
          className="flex-none px-0 pb-2 pt-0.5 text-xs group-data-[orientation=horizontal]/tabs:after:-bottom-0.5 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-brand-coral"
        >
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
