/**
 * @module
 * State and defaults for chart presentation.
 */

import { useState } from "react";
import type { LabelAlignment } from "./EditableChartLabel";

export const chartLinePatterns = {
  solid: "",
  dashed: "8 5",
  dotted: "2 4",
  dashdot: "8 4 2 4",
};

/**
 * Creates local state and setters for chart presentation.
 * @param initial - Optional persisted chart values.
 * @returns Current settings and React state setters.
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
  const [grid, setGrid] = useState(initial?.grid ?? true);
  const [legend, setLegend] = useState(initial?.legend ?? true);
  const [legendOrientation, setLegendOrientation] = useState<"horizontal" | "vertical">(
    initial?.legendOrientation ?? "vertical",
  );
  const [legendPosition, setLegendPosition] = useState(initial?.legendPosition ?? { x: 1, y: 0.5 });
  const [xLog, setXLog] = useState(initial?.xLog ?? false);
  const [yLog, setYLog] = useState(initial?.yLog ?? false);
  const [xMin, setXMin] = useState(initial?.xMin ?? "");
  const [xMax, setXMax] = useState(initial?.xMax ?? "");
  const [yMin, setYMin] = useState(initial?.yMin ?? "");
  const [yMax, setYMax] = useState(initial?.yMax ?? "");
  const [ticks, setTicks] = useState(initial?.ticks ?? 5);
  const [color, setColor] = useState(initial?.color ?? "#f25a3c");
  const [radius, setRadius] = useState(initial?.radius ?? 5);
  const [symbol, setSymbol] = useState(initial?.symbol ?? "circle");
  const [lineStyle, setLineStyle] = useState<keyof typeof chartLinePatterns>(
    initial?.lineStyle ?? "solid",
  );
  const [lineWidth, setLineWidth] = useState(initial?.lineWidth ?? 2);
  const [visible, setVisible] = useState(initial?.visible ?? true);
  return {
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
    grid,
    setGrid,
    legend,
    setLegend,
    legendOrientation,
    setLegendOrientation,
    legendPosition,
    setLegendPosition,
    xLog,
    setXLog,
    yLog,
    setYLog,
    xMin,
    setXMin,
    xMax,
    setXMax,
    yMin,
    setYMin,
    yMax,
    setYMax,
    ticks,
    setTicks,
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
  };
}

export type ChartSettings = ReturnType<typeof useChartSettings>;

export type ChartValues = {
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
};
