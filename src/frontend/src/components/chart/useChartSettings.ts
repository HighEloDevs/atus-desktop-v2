/**
 * @module
 * State and defaults for chart presentation.
 */

import { useState } from "react";
import type { LabelAlignment } from "./EditableChartLabel";
import {
  axisDefaults,
  AXIS_STYLE_KEYS,
  clampAxisValue,
  restoreAxis,
  type AxisKey,
  type AxisSettings,
} from "./axisSettings";

export const chartLinePatterns = {
  solid: "",
  dashed: "8 5",
  dotted: "2 4",
  dashdot: "8 4 2 4",
};

/** Defaults of the residuals panel; "Restaurar padrão" applies them. */
export const residualDefaults = {
  yLabel: "Resíduo",
  stems: true,
  band: false,
  errorBars: true,
  histogram: false,
};

/**
 * Creates local state and setters for chart presentation.
 *
 * Each axis keeps its settings in one object (`xAxis`, `yAxis`). The legacy flat fields
 * (`xMin`, `xLog`, `ticks`, `grid`...) are derived from those objects and write back to
 * them, so the sidebar and the axis popover always show the same values. `ticks` and
 * `grid` cover both axes: writing them changes X and Y.
 * @param initial - Optional persisted chart values; projects saved before per-axis
 * settings migrate from the legacy fields.
 * @returns Current settings and setters.
 */
export function useChartSettings(initial?: Partial<ChartValues>) {
  const [title, setTitle] = useState(initial?.title ?? "Gráfico de exemplo");
  const [titleAlignment, setTitleAlignment] = useState<LabelAlignment>(
    initial?.titleAlignment ?? "center",
  );
  const [subtitleAlignment, setSubtitleAlignment] = useState<LabelAlignment>(
    initial?.subtitleAlignment ?? "center",
  );
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [xAlignment, setXAlignment] = useState<LabelAlignment>(initial?.xAlignment ?? "center");
  const [yAlignment, setYAlignment] = useState<LabelAlignment>(initial?.yAlignment ?? "center");
  const [xLabel, setXLabel] = useState(initial?.xLabel ?? "x");
  const [yLabel, setYLabel] = useState(initial?.yLabel ?? "y");
  const [legend, setLegend] = useState(initial?.legend ?? true);
  const [legendOrientation, setLegendOrientation] = useState<"horizontal" | "vertical">(
    initial?.legendOrientation ?? "vertical",
  );
  const [legendPosition, setLegendPosition] = useState(initial?.legendPosition ?? { x: 1, y: 0.5 });
  const [color, setColor] = useState(initial?.color ?? "#f25a3c");
  const [radius, setRadius] = useState(initial?.radius ?? 5);
  const [symbol, setSymbol] = useState(initial?.symbol ?? "circle");
  const [lineStyle, setLineStyle] = useState<keyof typeof chartLinePatterns>(
    initial?.lineStyle ?? "solid",
  );
  const [lineWidth, setLineWidth] = useState(initial?.lineWidth ?? 2);
  const [visible, setVisible] = useState(initial?.visible ?? true);
  const [residuals, setResiduals] = useState(initial?.residuals ?? false);
  const [residualYLabel, setResidualYLabel] = useState(
    initial?.residualYLabel ?? residualDefaults.yLabel,
  );
  const [residualStems, setResidualStems] = useState(
    initial?.residualStems ?? residualDefaults.stems,
  );
  const [residualBand, setResidualBand] = useState(initial?.residualBand ?? residualDefaults.band);
  const [residualErrorBars, setResidualErrorBars] = useState(
    initial?.residualErrorBars ?? residualDefaults.errorBars,
  );
  const [residualHistogram, setResidualHistogram] = useState(
    initial?.residualHistogram ?? residualDefaults.histogram,
  );
  const [axes, setAxes] = useState(() => ({
    x: restoreAxis("x", initial?.xAxis, initial),
    y: restoreAxis("y", initial?.yAxis, initial),
    residual: restoreAxis("residual", initial?.residualAxis, initial),
  }));
  const updateAxis = (axis: AxisKey, patch: Partial<AxisSettings>) =>
    setAxes((current) => ({ ...current, [axis]: { ...current[axis], ...patch } }));
  const updateBoth = (patch: Partial<AxisSettings>) =>
    setAxes((current) => ({
      ...current,
      x: { ...current.x, ...patch },
      y: { ...current.y, ...patch },
    }));
  /** Restores every setting of an axis; the title text is user content and stays. */
  const resetAxis = (axis: AxisKey) =>
    setAxes((current) => ({ ...current, [axis]: axisDefaults(axis) }));
  /**
   * Copies tick, grid and text style to another axis, leaving its range alone.
   * Without a target: X to Y, Y to X, and the residual axis to Y.
   */
  const copyAxisStyle = (from: AxisKey, target?: AxisKey) =>
    setAxes((current) => {
      const to: AxisKey = target ?? (from === "y" ? "x" : "y");
      const style = Object.fromEntries(AXIS_STYLE_KEYS.map((key) => [key, current[from][key]]));
      return { ...current, [to]: { ...current[to], ...style } };
    });
  return {
    xAxis: axes.x,
    yAxis: axes.y,
    residualAxis: axes.residual,
    updateAxis,
    resetAxis,
    copyAxisStyle,
    title,
    setTitle,
    titleAlignment,
    setTitleAlignment,
    subtitleAlignment,
    setSubtitleAlignment,
    subtitle,
    setSubtitle,
    xAlignment,
    setXAlignment,
    yAlignment,
    setYAlignment,
    xLabel,
    setXLabel,
    yLabel,
    setYLabel,
    /** True when either axis shows its major grid. */
    grid: axes.x.grid || axes.y.grid,
    setGrid: (grid: boolean) => updateBoth({ grid }),
    legend,
    setLegend,
    legendOrientation,
    setLegendOrientation,
    legendPosition,
    setLegendPosition,
    xLog: axes.x.log,
    setXLog: (log: boolean) => updateAxis("x", { log }),
    yLog: axes.y.log,
    setYLog: (log: boolean) => updateAxis("y", { log }),
    xMin: axes.x.min,
    setXMin: (min: string) => updateAxis("x", { min }),
    xMax: axes.x.max,
    setXMax: (max: string) => updateAxis("x", { max }),
    yMin: axes.y.min,
    setYMin: (min: string) => updateAxis("y", { min }),
    yMax: axes.y.max,
    setYMax: (max: string) => updateAxis("y", { max }),
    /** X tick count; the sidebar shows it only while both axes agree. */
    ticks: axes.x.ticks,
    setTicks: (ticks: number) => updateBoth({ ticks: clampAxisValue("ticks", ticks) }),
    color,
    setColor,
    radius,
    setRadius,
    symbol,
    setSymbol,
    lineStyle,
    setLineStyle,
    lineWidth,
    setLineWidth,
    visible,
    setVisible,
    residuals,
    setResiduals,
    residualYLabel,
    setResidualYLabel,
    residualYMin: axes.residual.min,
    setResidualYMin: (min: string) => updateAxis("residual", { min }),
    residualYMax: axes.residual.max,
    setResidualYMax: (max: string) => updateAxis("residual", { max }),
    residualStems,
    setResidualStems,
    residualBand,
    setResidualBand,
    residualErrorBars,
    setResidualErrorBars,
    residualHistogram,
    setResidualHistogram,
  };
}

export type ChartSettings = ReturnType<typeof useChartSettings>;

export type ChartValues = {
  /** Settings of the X axis; projects saved without it migrate from the legacy fields. */
  xAxis: AxisSettings;
  /** Settings of the Y axis; projects saved without it migrate from the legacy fields. */
  yAxis: AxisSettings;
  /** Settings of the residuals Y axis; older projects migrate from `residualYMin/Max`. */
  residualAxis: AxisSettings;
  title: string;
  titleAlignment: LabelAlignment;
  subtitleAlignment: LabelAlignment;
  subtitle: string;
  xAlignment: LabelAlignment;
  yAlignment: LabelAlignment;
  xLabel: string;
  yLabel: string;
  grid: boolean;
  legend: boolean;
  legendOrientation: "horizontal" | "vertical";
  legendPosition: { x: number; y: number };
  /** Legacy fields below are derived from the axes and still saved for older versions. */
  xLog: boolean;
  yLog: boolean;
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
  ticks: number;
  color: string;
  radius: number;
  symbol: string;
  lineStyle: keyof typeof chartLinePatterns;
  lineWidth: number;
  visible: boolean;
  /** Whether the residuals panel is requested (it only shows when residuals exist). */
  residuals: boolean;
  residualYLabel: string;
  residualYMin: string;
  residualYMax: string;
  residualStems: boolean;
  residualBand: boolean;
  residualErrorBars: boolean;
  residualHistogram: boolean;
};
