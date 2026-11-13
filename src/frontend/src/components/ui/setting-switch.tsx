/**
 * @module
 * Labeled boolean setting control.
 */

type SettingSwitchProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/**
 * Renders a labeled boolean setting.
 * @param props - Display label, current value, and change callback.
 * @returns The rendered React element.
 */
export function SettingSwitch({ label, value, onChange }: SettingSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-[#d8ded7] bg-white px-3 py-2.5 text-left font-medium transition-colors hover:bg-[#f4f6f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {label}
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
