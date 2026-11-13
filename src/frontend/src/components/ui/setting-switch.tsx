/**
 * @module
 * Labeled boolean setting control.
 */

type SettingSwitchProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Optional secondary line explaining the setting. */
  description?: string;
  /** Blocks changes and dims the control; the description should say why. */
  disabled?: boolean;
};

/**
 * Renders a labeled boolean setting.
 * @param props - Display label, current value, change callback, and optional description and disabled state.
 * @returns The rendered React element.
 */
export function SettingSwitch({
  label,
  value,
  onChange,
  description,
  disabled,
}: SettingSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onChange(!value);
      }}
      className={`flex w-full items-center justify-between gap-3 rounded-md border border-[#d8ded7] bg-white px-3 py-2.5 text-left font-medium transition-colors hover:bg-[#f4f6f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
    >
      <span className="min-w-0">
        {label}
        {description && (
          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${value ? "bg-brand-coral" : "bg-[#aab4ac]"}`}
      >
        <span
          className={`size-4 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-4" : ""}`}
        />
      </span>
    </button>
  );
}
