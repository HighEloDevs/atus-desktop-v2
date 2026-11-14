/**
 * @module
 * Chart legend: draggable, and clickable to open a popover with its content, position
 * and look. Visibility, orientation and position share state with the sidebar.
 */

import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tex } from "@/features/analysis/fit/Tex";
import {
  clampLegendValue,
  LEGEND_BOUNDS,
  legendAnchor,
  type LegendBackground,
} from "./legendSettings";
import { OptionRow } from "./OptionRow";
import {
  Field,
  headingClass,
  PopoverHeader,
  PopoverTabsList,
  sectionClass,
  Segmented,
  Stepper,
} from "./PopoverFields";
import { chartLinePatterns, type ChartSettings } from "./useChartSettings";

/** What the legend needs from each visible series. */
export type LegendSeries = {
  id: string;
  name: string;
  color: string;
  symbol: string;
  lineStyle: keyof typeof chartLinePatterns;
  lineWidth: number;
  /** Fitted equation with its values, in LaTeX; absent before a successful fit. */
  legendEquation?: string;
};

type Tab = "content" | "position" | "look";

/** Pointer travel, in pixels, that turns a press into a drag instead of a click. */
const DRAG_THRESHOLD = 4;

const ICONS = {
  fitLine: (
    <>
      <path d="M4 12h16" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </>
  ),
  equation: <path d="M5 8h6M8 5v6M13 16h6M5 16h4" />,
  border: <rect x="4" y="6" width="16" height="12" rx="2" />,
};

const BACKGROUNDS: Record<LegendBackground, string> = {
  none: "",
  light: "bg-white/90",
  solid: "bg-white shadow-sm",
};

const ROWS = ["superior", "meio", "inferior"];
const COLUMNS = ["esquerdo", "centro", "direito"];

/**
 * Marker of a series in the legend, with the series symbol.
 * @param props - Symbol, color and radius in pixels.
 * @returns The rendered SVG.
 */
function LegendMarker({ symbol, color, size }: { symbol: string; color: string; size: number }) {
  const box = size * 2;
  return (
    <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
      {symbol === "circle" ? (
        <circle cx={size} cy={size} r={size} fill={color} />
      ) : (
        <rect
          x={symbol === "diamond" ? size * 0.3 : 0}
          y={symbol === "diamond" ? size * 0.3 : 0}
          width={symbol === "diamond" ? size * 1.4 : box}
          height={symbol === "diamond" ? size * 1.4 : box}
          fill={color}
          transform={symbol === "diamond" ? `rotate(45 ${size} ${size})` : undefined}
        />
      )}
    </svg>
  );
}

/**
 * The legend settings form, in three tabs.
 * @param props - Chart settings, current tab, and tab callback.
 * @returns The rendered React element.
 */
function LegendForm({
  settings,
  tab,
  onTabChange,
  onHide,
}: {
  settings: ChartSettings;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onHide: () => void;
}) {
  const { legendStyle: style, updateLegendStyle: update } = settings;
  const anchor = legendAnchor(settings.legendPosition);
  return (
    <>
      <Tabs value={tab} onValueChange={(next) => onTabChange(next as Tab)} className="gap-0">
        <PopoverTabsList
          tabs={[
            ["content", "Conteúdo"],
            ["position", "Posição"],
            ["look", "Aparência"],
          ]}
        />
        <div className="min-h-[300px]">
          <TabsContent value="content">
            <section className={sectionClass}>
              <h3 className={headingClass}>Itens</h3>
              <div className="-mx-2 grid gap-0.5">
                <OptionRow
                  icon={ICONS.fitLine}
                  title="Linha de ajuste"
                  value={style.fitLine}
                  onChange={(fitLine) => update({ fitLine })}
                />
                <OptionRow
                  icon={ICONS.equation}
                  title="Equação do ajuste"
                  value={style.equation}
                  onChange={(equation) => update({ equation })}
                />
              </div>
            </section>
            <section className={sectionClass}>
              <h3 className={headingClass}>Título</h3>
              <Field label="Texto" htmlFor="legend-title">
                <Input
                  id="legend-title"
                  className="h-8 text-xs"
                  placeholder="Sem título"
                  value={style.title}
                  onChange={(event) => update({ title: event.target.value })}
                />
              </Field>
            </section>
          </TabsContent>
          <TabsContent value="position">
            <section className={sectionClass}>
              <h3 className={headingClass}>Lugar</h3>
              <Field label="Canto">
                <div
                  role="group"
                  aria-label="Canto"
                  className="grid w-full grid-cols-3 gap-[3px] rounded-md bg-muted p-[3px]"
                >
                  {[0, 0.5, 1].flatMap((y, row) =>
                    [0, 0.5, 1].map((x, column) => {
                      const on = anchor?.x === x && anchor?.y === y;
                      const name =
                        x === 0.5 && y === 0.5 ? "Centro" : `${ROWS[row]} ${COLUMNS[column]}`;
                      return (
                        <button
                          key={`${x}-${y}`}
                          type="button"
                          aria-label={name.charAt(0).toUpperCase() + name.slice(1)}
                          aria-pressed={on}
                          onClick={() => settings.setLegendPosition({ x, y })}
                          className={`group grid h-[22px] place-items-center rounded focus-visible:outline-2 focus-visible:outline-brand-coral ${on ? "bg-background shadow-sm" : ""}`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${on ? "bg-foreground" : "bg-muted-foreground/50 group-hover:bg-muted-foreground"}`}
                          />
                        </button>
                      );
                    }),
                  )}
                </div>
              </Field>
            </section>
            <section className={sectionClass}>
              <h3 className={headingClass}>Layout</h3>
              <Field label="Orientação">
                <Segmented
                  label="Orientação"
                  value={settings.legendOrientation}
                  options={[
                    { value: "vertical", label: "Vertical" },
                    { value: "horizontal", label: "Horizontal" },
                  ]}
                  onChange={settings.setLegendOrientation}
                />
              </Field>
              {settings.legendOrientation === "horizontal" && (
                <Field label="Colunas">
                  <Stepper
                    label="colunas"
                    value={style.columns}
                    bounds={LEGEND_BOUNDS.columns}
                    display={style.columns === 0 ? "auto" : undefined}
                    onChange={(columns) =>
                      update({ columns: clampLegendValue("columns", columns) })
                    }
                  />
                </Field>
              )}
            </section>
          </TabsContent>
          <TabsContent value="look">
            <section className={sectionClass}>
              <h3 className={headingClass}>Caixa</h3>
              <Field label="Fundo" htmlFor="legend-background">
                <NativeSelect
                  id="legend-background"
                  className="h-8 w-full text-xs"
                  value={style.background}
                  onChange={(event) =>
                    update({ background: event.target.value as LegendBackground })
                  }
                >
                  <NativeSelectOption value="none">Nenhum</NativeSelectOption>
                  <NativeSelectOption value="light">Translúcido</NativeSelectOption>
                  <NativeSelectOption value="solid">Sólido</NativeSelectOption>
                </NativeSelect>
              </Field>
              <div className="-mx-2 grid gap-0.5">
                <OptionRow
                  icon={ICONS.border}
                  title="Borda"
                  value={style.border}
                  onChange={(border) => update({ border })}
                />
              </div>
            </section>
            <section className={sectionClass}>
              <h3 className={headingClass}>Texto</h3>
              <Field label="Fonte">
                <Stepper
                  label="fonte da legenda"
                  value={style.fontSize}
                  bounds={LEGEND_BOUNDS.fontSize}
                  display={`${style.fontSize} px`}
                  onChange={(fontSize) =>
                    update({ fontSize: clampLegendValue("fontSize", fontSize) })
                  }
                />
              </Field>
              <Field label="Marcadores">
                <Stepper
                  label="marcadores"
                  value={style.markerSize}
                  bounds={LEGEND_BOUNDS.markerSize}
                  display={`${style.markerSize} px`}
                  onChange={(markerSize) =>
                    update({ markerSize: clampLegendValue("markerSize", markerSize) })
                  }
                />
              </Field>
            </section>
          </TabsContent>
        </div>
      </Tabs>
      <footer className="flex items-center justify-between gap-2 border-t border-border px-4 pb-3.5 pt-2.5 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={onHide}
          className="text-foreground underline underline-offset-2"
        >
          Ocultar legenda
        </button>
        <button
          type="button"
          onClick={settings.resetLegend}
          className="text-foreground underline underline-offset-2"
        >
          Restaurar padrão
        </button>
      </footer>
    </>
  );
}

/**
 * The legend inside the chart area, or a "Mostrar legenda" button when it is hidden.
 *
 * Hovering outlines the legend and shows a hint; dragging more than a few pixels moves
 * it, and a click (or Enter) opens its settings popover. The button that brings a hidden
 * legend back is left out of image exports.
 * @param props - Chart settings, visible series, the element the legend moves within,
 * and the left margin of the plot (where the restore button sits).
 * @returns The rendered React element.
 */
export function ChartLegend({
  settings,
  series,
  bounds,
  plotLeft,
}: {
  settings: ChartSettings;
  series: LegendSeries[];
  bounds: RefObject<HTMLElement | null>;
  plotLeft: number;
}) {
  const { legend, setLegend, legendOrientation, legendPosition, setLegendPosition } = settings;
  const style = settings.legendStyle;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("content");
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const dragged = useRef(false);

  if (!legend)
    return (
      <button
        type="button"
        data-html2canvas-ignore="true"
        onClick={() => setLegend(true)}
        className="absolute top-2 z-[3] rounded-md border border-dashed border-input bg-white px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        style={{ left: plotLeft + 8 }}
      >
        Mostrar legenda
      </button>
    );

  const layout: CSSProperties =
    legendOrientation === "vertical"
      ? { display: "flex", flexDirection: "column" }
      : style.columns > 0
        ? { display: "grid", gridTemplateColumns: `repeat(${style.columns}, auto)` }
        : { display: "flex", flexDirection: "row", flexWrap: "wrap" };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Legenda"
          className={`absolute z-[1] max-w-full touch-none cursor-grab select-none gap-x-4 gap-y-1 rounded px-2 py-1 text-left text-[#66716e] outline-1 outline-offset-2 outline-dashed outline-transparent transition-[outline-color] hover:outline-[#20272c] active:cursor-grabbing data-[state=open]:outline-[#20272c] ${BACKGROUNDS[style.background]} ${style.border ? "border border-border" : ""}`}
          style={{
            ...layout,
            fontSize: style.fontSize,
            left: `${legendPosition.x * 100}%`,
            top: `${legendPosition.y * 100}%`,
            transform: `translate(${-legendPosition.x * 100}%, ${-legendPosition.y * 100}%)`,
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            drag.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              offsetX: event.clientX - rect.left,
              offsetY: event.clientY - rect.top,
              moved: false,
            };
            dragged.current = false;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            // Keep the chart from starting a pan under the legend.
            event.stopPropagation();
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            const parent = bounds.current;
            if (!current || current.pointerId !== event.pointerId || !parent) {
              if (!open) {
                const rect = event.currentTarget.getBoundingClientRect();
                setHint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
              }
              return;
            }
            if (
              !current.moved &&
              Math.hypot(event.clientX - current.startX, event.clientY - current.startY) <
                DRAG_THRESHOLD
            )
              return;
            current.moved = true;
            setHint(null);
            setOpen(false);
            const area = parent.getBoundingClientRect();
            const rect = event.currentTarget.getBoundingClientRect();
            const availableX = Math.max(0, area.width - rect.width);
            const availableY = Math.max(0, area.height - rect.height);
            const fraction = (value: number, available: number) =>
              available ? Math.max(0, Math.min(1, value / available)) : 0;
            setLegendPosition({
              x: fraction(event.clientX - area.left - current.offsetX, availableX),
              y: fraction(event.clientY - area.top - current.offsetY, availableY),
            });
          }}
          onPointerUp={() => {
            dragged.current = drag.current?.moved ?? false;
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onPointerLeave={() => setHint(null)}
          onClick={(event) => {
            // A drag ends with a click; it must not toggle the popover.
            if (dragged.current) {
              dragged.current = false;
              event.preventDefault();
            }
            setHint(null);
          }}
        >
          {style.title && (
            <span className="font-semibold text-foreground" style={{ gridColumn: "1 / -1" }}>
              {style.title}
            </span>
          )}
          {series.map((item) => (
            <span key={item.id} className="flex items-center gap-1.5 whitespace-nowrap">
              <LegendMarker symbol={item.symbol} color={item.color} size={style.markerSize} />
              {style.fitLine && (
                <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
                  <line
                    x1="0"
                    x2="18"
                    y1="4"
                    y2="4"
                    stroke={item.color}
                    strokeWidth={Math.min(item.lineWidth, 3)}
                    strokeDasharray={chartLinePatterns[item.lineStyle]}
                  />
                </svg>
              )}
              <span>{item.name}</span>
              {style.equation && item.legendEquation && (
                <Tex latex={item.legendEquation} className="text-foreground/80" />
              )}
            </span>
          ))}
          {hint && !open && (
            <span
              aria-hidden="true"
              data-html2canvas-ignore="true"
              className="pointer-events-none absolute z-20 whitespace-nowrap rounded-[5px] bg-foreground px-2 py-1 text-[11.5px] text-background"
              style={{ left: hint.x + 14, top: hint.y + 18 }}
            >
              Legenda · clique para ajustar, arraste para mover
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        collisionPadding={12}
        className="max-h-[var(--radix-popover-content-available-height)] w-[316px] overflow-y-auto rounded-[14px] p-0"
      >
        <PopoverHeader title="Legenda" />
        <LegendForm
          settings={settings}
          tab={tab}
          onTabChange={setTab}
          onHide={() => {
            setOpen(false);
            setLegend(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
