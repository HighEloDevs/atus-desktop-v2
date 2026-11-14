/**
 * @module
 * Click target over the tick labels of a chart axis and the popover with that axis'
 * settings: limits and scale, ticks and grid, and title and number text.
 */

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AXIS_BOUNDS,
  axisLimitsError,
  axisStepError,
  clampAxisValue,
  type AxisKey,
  type AxisSettings,
  type TickRotation,
} from "./axisSettings";
import { OptionRow } from "./OptionRow";
import type { ChartSettings } from "./useChartSettings";

/** Position and size, in pixels, of an axis click target inside the chart area. */
export type AxisBox = { left: number; top: number; width: number; height: number };

type Tab = "interval" | "ticks" | "text";

const ICONS = {
  log: <path d="M4 19C9 19 11 5 20 5" />,
  invert: <path d="M8 20V4M5 7l3-3 3 3M16 4v16M13 17l3 3 3-3" />,
  edge: <path d="M5 4v16h15" />,
  grid: <path d="M4 9h16M4 15h16M9 4v16M15 4v16" />,
  minorGrid: <path d="M4 7h16M4 12h16M4 17h16M7 4v16M12 4v16M17 4v16" strokeWidth="1.2" />,
};

const TICK_GLYPHS = {
  out: "M5 6V11M9 6V11",
  in: "M5 6V1M9 6V1",
  cross: "M5 1V11M9 1V11",
};

const sectionClass = "grid gap-2 border-t border-border px-4 py-3";
const headingClass =
  "mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";

/**
 * One form row: label on the left, a fixed control column on the right.
 * @param props - Label text, the control, and the id the label points to.
 * @returns The rendered React element.
 */
function Field({
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
function Segmented<T extends string>({
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
function Stepper({
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
function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[11.5px] text-destructive">
      {children}
    </p>
  );
}

const tickGlyph = (path: string) => (
  <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
    <path d={`M1 6H13 ${path}`} stroke="currentColor" strokeWidth="1.4" fill="none" />
  </svg>
);

/**
 * The settings form of one axis, organized in three tabs.
 * @param props - Axis, chart settings, visible range, current tab, and tab callback.
 * @returns The rendered React element.
 */
function AxisSettingsForm({
  axis,
  settings,
  domain,
  tab,
  onTabChange,
}: {
  axis: AxisKey;
  settings: ChartSettings;
  domain: [number, number];
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const values: AxisSettings = axis === "x" ? settings.xAxis : settings.yAxis;
  const update = (patch: Partial<AxisSettings>) => settings.updateAxis(axis, patch);
  const title = axis === "x" ? settings.xLabel : settings.yLabel;
  const setTitle = axis === "x" ? settings.setXLabel : settings.setYLabel;
  const other = axis === "x" ? "Y" : "X";
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const limitsError = axisLimitsError(values);
  const stepError = axisStepError(values, domain);
  const id = (name: string) => `axis-${axis}-${name}`;
  return (
    <>
      <Tabs value={tab} onValueChange={(next) => onTabChange(next as Tab)} className="gap-0">
        <TabsList
          variant="line"
          className="relative z-10 h-auto w-full justify-start gap-4 px-4 pb-0"
        >
          {(
            [
              ["interval", "Intervalo"],
              ["ticks", "Marcações"],
              ["text", "Texto"],
            ] as const
          ).map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-none px-0 pb-2 pt-0.5 text-xs group-data-[orientation=horizontal]/tabs:after:-bottom-0.5 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-brand-coral"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-h-[330px]">
          <TabsContent value="interval">
            <section className={sectionClass}>
              <h3 className={headingClass}>Limites</h3>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label className="grid gap-1 text-[11px] text-muted-foreground" htmlFor={id("min")}>
                  Mínimo
                  <Input
                    id={id("min")}
                    type="number"
                    step="any"
                    placeholder="auto"
                    aria-invalid={limitsError ? true : undefined}
                    className="h-8 font-mono text-xs"
                    value={values.min}
                    onChange={(event) => update({ min: event.target.value })}
                  />
                </label>
                <span aria-hidden="true" className="pb-[9px] text-muted-foreground">
                  –
                </span>
                <label className="grid gap-1 text-[11px] text-muted-foreground" htmlFor={id("max")}>
                  Máximo
                  <Input
                    id={id("max")}
                    type="number"
                    step="any"
                    placeholder="auto"
                    aria-invalid={limitsError ? true : undefined}
                    className="h-8 font-mono text-xs"
                    value={values.max}
                    onChange={(event) => update({ max: event.target.value })}
                  />
                </label>
              </div>
              {limitsError && <FieldError>{limitsError}</FieldError>}
            </section>
            <section className={sectionClass}>
              <h3 className={headingClass}>Escala</h3>
              <div className="-mx-2 grid gap-0.5">
                <OptionRow
                  icon={ICONS.log}
                  title="Escala logarítmica"
                  value={values.log}
                  onChange={(log) => update(log ? { log, min: "", max: "" } : { log })}
                />
                <OptionRow
                  icon={ICONS.invert}
                  title="Inverter sentido"
                  value={values.invert}
                  onChange={(invert) => update({ invert })}
                />
                <OptionRow
                  icon={ICONS.edge}
                  title="Eixo na borda"
                  value={values.edge}
                  onChange={(edge) => update({ edge })}
                />
              </div>
            </section>
          </TabsContent>
          <TabsContent value="ticks">
            <section className={sectionClass}>
              <h3 className={headingClass}>Divisões</h3>
              <Field label="Espaçamento">
                <Segmented
                  label="Espaçamento"
                  value={values.spacing}
                  disabled={values.log}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "step", label: "Passo fixo" },
                  ]}
                  onChange={(spacing) => update({ spacing })}
                />
              </Field>
              {!values.log && values.spacing === "auto" && (
                <Field label="Divisões">
                  <Stepper
                    label="divisões"
                    value={values.ticks}
                    bounds={AXIS_BOUNDS.ticks}
                    onChange={(ticks) => update({ ticks: clampAxisValue("ticks", ticks) })}
                  />
                </Field>
              )}
              {!values.log && values.spacing === "step" && (
                <>
                  <Field label="Passo" htmlFor={id("step")}>
                    <Input
                      id={id("step")}
                      type="number"
                      step="any"
                      min="0"
                      placeholder="auto"
                      aria-invalid={stepError ? true : undefined}
                      className="h-8 font-mono text-xs"
                      value={values.step}
                      onChange={(event) => update({ step: event.target.value })}
                    />
                  </Field>
                  {stepError && <FieldError>{stepError}</FieldError>}
                </>
              )}
              <Field label="Subdivisões">
                <Stepper
                  label="subdivisões"
                  value={values.minor}
                  bounds={AXIS_BOUNDS.minor}
                  display={values.minor === 0 ? "—" : undefined}
                  onChange={(minor) =>
                    update({
                      minor: clampAxisValue("minor", minor),
                      ...(minor <= 0 ? { minorGrid: false } : {}),
                    })
                  }
                />
              </Field>
              <Field label="Traços">
                <Segmented
                  label="Traços"
                  value={values.tickDirection}
                  options={[
                    { value: "out", label: tickGlyph(TICK_GLYPHS.out), name: "Para fora" },
                    { value: "in", label: tickGlyph(TICK_GLYPHS.in), name: "Para dentro" },
                    { value: "cross", label: tickGlyph(TICK_GLYPHS.cross), name: "Cruzados" },
                  ]}
                  onChange={(tickDirection) => update({ tickDirection })}
                />
              </Field>
            </section>
            <section className={sectionClass}>
              <h3 className={headingClass}>Grade</h3>
              <div className="-mx-2 grid gap-0.5">
                <OptionRow
                  icon={ICONS.grid}
                  title="Grade principal"
                  value={values.grid}
                  onChange={(grid) => update({ grid })}
                />
                <OptionRow
                  icon={ICONS.minorGrid}
                  title="Grade secundária"
                  value={values.minorGrid}
                  disabled={values.minor === 0}
                  onChange={(minorGrid) => update({ minorGrid })}
                />
              </div>
            </section>
          </TabsContent>
          <TabsContent value="text">
            <section className={sectionClass}>
              <h3 className={headingClass}>Título</h3>
              <Field label="Texto" htmlFor={id("title")}>
                <Input
                  id={id("title")}
                  className="h-8 text-xs"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              <Field label="Fonte">
                <Stepper
                  label="fonte do título"
                  value={values.titleSize}
                  bounds={AXIS_BOUNDS.titleSize}
                  display={`${values.titleSize} px`}
                  onChange={(titleSize) =>
                    update({ titleSize: clampAxisValue("titleSize", titleSize) })
                  }
                />
              </Field>
            </section>
            <section className={sectionClass}>
              <h3 className={headingClass}>Números</h3>
              <Field label="Formato" htmlFor={id("format")}>
                <NativeSelect
                  id={id("format")}
                  className="h-8 w-full text-xs"
                  value={values.format}
                  onChange={(event) =>
                    update({ format: event.target.value as AxisSettings["format"] })
                  }
                >
                  <NativeSelectOption value="auto">Automático</NativeSelectOption>
                  <NativeSelectOption value="decimal">Decimal · 1,50</NativeSelectOption>
                  <NativeSelectOption value="scientific">Científico · 1,5×10⁰</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field label="Casas decimais">
                <Stepper
                  label="casas decimais"
                  value={values.decimals}
                  bounds={AXIS_BOUNDS.decimals}
                  disabled={values.format === "auto"}
                  display={values.format === "auto" ? "—" : undefined}
                  onChange={(decimals) =>
                    update({ decimals: clampAxisValue("decimals", decimals) })
                  }
                />
              </Field>
              <Field label="Fonte">
                <Stepper
                  label="fonte dos números"
                  value={values.fontSize}
                  bounds={AXIS_BOUNDS.fontSize}
                  display={`${values.fontSize} px`}
                  onChange={(fontSize) =>
                    update({ fontSize: clampAxisValue("fontSize", fontSize) })
                  }
                />
              </Field>
              {axis === "x" && (
                <Field label="Rotação">
                  <Segmented
                    label="Rotação"
                    value={String(values.rotation) as "0" | "45" | "90"}
                    options={[
                      { value: "0", label: "0°" },
                      { value: "45", label: "45°" },
                      { value: "90", label: "90°" },
                    ]}
                    onChange={(rotation) => update({ rotation: Number(rotation) as TickRotation })}
                  />
                </Field>
              )}
            </section>
          </TabsContent>
        </div>
      </Tabs>
      <footer className="flex items-center justify-between gap-2 border-t border-border px-4 pb-3.5 pt-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-baseline gap-2">
          <button
            type="button"
            title="Copia marcações e texto, sem os limites"
            onClick={() => {
              settings.copyAxisStyle(axis);
              setCopied(true);
            }}
            className="text-foreground underline underline-offset-2"
          >
            Copiar estilo para {other}
          </button>
          <span aria-live="polite">{copied ? "Copiado" : ""}</span>
        </span>
        <button
          type="button"
          onClick={() => settings.resetAxis(axis)}
          className="text-foreground underline underline-offset-2"
        >
          Restaurar padrão
        </button>
      </footer>
    </>
  );
}

/**
 * Click target over the tick labels of one axis, with the axis settings popover.
 *
 * Hovering highlights the strip and shows a short hint next to the pointer; a click,
 * Enter or Space opens the popover next to where it was clicked, and Esc closes it,
 * returning focus to the strip. The strip is left out of image exports.
 * @param props - Axis, chart settings, target box, visible range, and a callback that receives the highlight state (hover or open).
 * @returns The rendered React element.
 */
export function AxisSettingsPopover({
  axis,
  settings,
  box,
  domain,
  onHighlightChange,
}: {
  axis: AxisKey;
  settings: ChartSettings;
  box: AxisBox;
  domain: [number, number];
  onHighlightChange: (highlighted: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [tab, setTab] = useState<Tab>("interval");
  const highlighted = open || hover !== null;
  useEffect(() => onHighlightChange(highlighted), [highlighted, onHighlightChange]);
  const name = axis.toUpperCase();
  const center = { x: box.width / 2, y: box.height / 2 };
  // The popover opens beside the strip, level with the click: right of Y, above X.
  const at =
    axis === "y" ? { x: box.width, y: (anchor ?? center).y } : { x: (anchor ?? center).x, y: 0 };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setHover(null);
        else setAnchor(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Configurar eixo ${name}`}
          data-html2canvas-ignore="true"
          className="absolute z-[2] cursor-pointer rounded-md outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-brand-coral data-[state=open]:bg-foreground/[0.06] data-[state=open]:ring-1 data-[state=open]:ring-foreground/25"
          style={box}
          onPointerMove={(event) => {
            if (open) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setHover({ x: event.clientX - rect.left, y: event.clientY - rect.top });
          }}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setAnchor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
          }}
        >
          {hover && !open && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-20 whitespace-nowrap rounded-[5px] bg-foreground px-2 py-1 text-[11.5px] text-background"
              style={{
                left: axis === "x" && hover.x > box.width - 190 ? hover.x - 184 : hover.x + 14,
                top: hover.y - 30,
              }}
            >
              Eixo {name} · clique para ajustar
            </span>
          )}
          <PopoverAnchor asChild>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-px"
              style={{ left: at.x, top: at.y }}
            />
          </PopoverAnchor>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={axis === "x" ? "top" : "right"}
        align="center"
        collisionPadding={12}
        className="max-h-[var(--radix-popover-content-available-height)] w-[316px] overflow-y-auto rounded-[14px] p-0"
      >
        <header className="flex items-center justify-between py-3 pl-4 pr-3.5">
          <h2 className="text-[13px] font-semibold">Eixo {name}</h2>
          <PopoverClose
            aria-label="Fechar"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand-coral"
          >
            <X size={15} />
          </PopoverClose>
        </header>
        <AxisSettingsForm
          axis={axis}
          settings={settings}
          domain={domain}
          tab={tab}
          onTabChange={setTab}
        />
      </PopoverContent>
    </Popover>
  );
}
