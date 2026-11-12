/**
 * @module
 * Select control for the import separator.
 */

import type { SeparatorType } from "./text-data-parser";

/**
 * Lists the import separators with an automatic option.
 * @param props - Accessible label, current value, change callback and optional class name.
 * @returns The rendered select element.
 */
export function SeparatorSelect({
  label,
  value,
  onChange,
  className = "rounded border border-[#d8ded7] bg-white text-[11px] text-[#35443a]",
}: {
  label: string;
  value: SeparatorType;
  onChange: (value: SeparatorType) => void;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as SeparatorType)}
      className={className}
    >
      <option value="auto">Automático</option>
      <option value=",">Vírgula</option>
      <option value=";">Ponto e vírgula</option>
      <option value={"\t"}>Tabulação</option>
      <option value=" ">Espaço</option>
    </select>
  );
}
