/**
 * @module
 * Fit model input with the `f(x) =` prefix and a live KaTeX preview.
 */

import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "cn";
import type { ClipboardEventHandler, KeyboardEventHandler, Ref } from "react";
import { equationToLatex } from "./equation-to-latex";

const prefix = katex.renderToString("f(x) =", { throwOnError: false });

/** Visual density: `default` fits the analysis sidebar, `large` the quick analysis window. */
export type EquationFieldSize = "default" | "large";

type EquationFieldProps = {
  /** Current equation text, in the mathjs-compatible ATUS syntax. */
  value: string;
  /** Called with the new text on every edit. */
  onChange: (value: string) => void;
  /** Accessible name of the text input. */
  label: string;
  /** Id of the input, so an external `<label htmlFor>` can point to it. */
  id?: string;
  /** Text shown while empty; also previewed, faded, until something is typed. */
  placeholder?: string;
  /** Visual density. Defaults to `default`. */
  size?: EquationFieldSize;
  /** Marks the field as invalid for assistive technology and shows the error border. */
  invalid?: boolean;
  /** Id of the element that describes the field, for example its error message. */
  describedBy?: string;
  /** Ref to the text input, for focusing it from outside. */
  inputRef?: Ref<HTMLInputElement>;
  /** Key handler of the text input. */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Paste handler of the text input, for example to take pasted data elsewhere. */
  onPaste?: ClipboardEventHandler<HTMLInputElement>;
  /** Focuses the input when mounted. */
  autoFocus?: boolean;
};

/**
 * Renders the model input and its LaTeX preview. The preview shows the placeholder, faded, while
 * the field is empty, so the expected syntax is visible before typing.
 *
 * @param props - Value, change handler, accessible label and presentation options.
 * @returns The rendered React element.
 * @example
 * <EquationField label="Função de ajuste" value={equation} onChange={setEquation} />
 */
export function EquationField({
  value,
  onChange,
  label,
  id,
  placeholder = "a * x + b",
  size = "default",
  invalid = false,
  describedBy,
  inputRef,
  onKeyDown,
  onPaste,
  autoFocus,
}: EquationFieldProps) {
  const large = size === "large";
  const preview = equationToLatex(value || placeholder);
  const html = preview
    ? katex.renderToString(`f(x) = ${preview}`, { throwOnError: false, displayMode: true })
    : "";
  return (
    <div
      data-invalid={invalid || undefined}
      className={cn(
        "overflow-hidden rounded-lg border bg-white transition-shadow focus-within:ring-2",
        invalid
          ? "border-[#c13a32] ring-1 ring-[#c13a32] focus-within:ring-[#c13a32]/20"
          : "border-input focus-within:border-ring focus-within:ring-ring/20",
      )}
    >
      <div className={cn("flex items-center gap-2 px-3", large ? "min-h-12" : "min-h-10")}>
        <span
          aria-hidden="true"
          className={cn("shrink-0 text-muted-foreground", large && "text-[17px]")}
          dangerouslySetInnerHTML={{ __html: prefix }}
        />
        <input
          id={id}
          ref={inputRef}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            "min-w-0 flex-1 bg-transparent font-mono outline-none placeholder:text-muted-foreground/60",
            large ? "text-[16px] font-medium" : "text-[13px]",
          )}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div
        aria-label="Pré-visualização da equação em LaTeX"
        aria-live="polite"
        className={cn(
          "flex items-center justify-center overflow-x-auto border-t border-border bg-background px-3 text-center",
          large
            ? "min-h-[72px] text-[19px] [&_.katex-display]:my-2"
            : "min-h-[76px] text-[15px] [&_.katex-display]:my-3",
          !value.trim() && "opacity-40",
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
