import { useState } from "react";
import type { LabelAlignment } from "./EditableChartLabel";

export const chartLinePatterns = {
  solid: "",
  dashed: "8 5",
  dotted: "2 4",
  dashdot: "8 4 2 4",
};

type Metric = "count" | "percent" | "density" | "cumulative";
type Column = "x" | "y" | "sx" | "sy";

export function useChartSettings() {
  const [title, setTitle] = useState("Gráfico de exemplo");
  const [titleAlignment, setTitleAlignment] = useState<LabelAlignment>("center");
  const [subtitleAlignment, setSubtitleAlignment] = useState<LabelAlignment>("center");
  const [subtitle, setSubtitle] = useState("");
  const [xAlignment, setXAlignment] = useState<LabelAlignment>("center");
  const [yAlignment, setYAlignment] = useState<LabelAlignment>("center");
  const [xLabel, setXLabel] = useState("x");
  const [yLabel, setYLabel] = useState("y");
  const [grid, setGrid] = useState(true);
  const [legend, setLegend] = useState(true);
  const [xLog, setXLog] = useState(false);
  const [yLog, setYLog] = useState(false);
  const [xMin, setXMin] = useState("");
  const [xMax, setXMax] = useState("");
  const [yMin, setYMin] = useState("");
  const [yMax, setYMax] = useState("");
  const [ticks, setTicks] = useState(5);
  const [color, setColor] = useState("#f25a3c");
  const [radius, setRadius] = useState(5);
  const [symbol, setSymbol] = useState("circle");
  const [lineStyle, setLineStyle] = useState<keyof typeof chartLinePatterns>("solid");
  const [lineWidth, setLineWidth] = useState(2);
  const [mode, setMode] = useState<"points" | "histogram">("points");
  const [column, setColumn] = useState<Column>("x");
  const [metric, setMetric] = useState<Metric>("count");
  const [bins, setBins] = useState(0);
  const [opacity, setOpacity] = useState(0.8);
  const [visible, setVisible] = useState(true);
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
    mode,
    setMode,
    column,
    setColumn,
    metric,
    setMetric,
    bins,
    setBins,
    opacity,
    setOpacity,
    visible,
    setVisible,
  };
}

export type ChartSettings = ReturnType<typeof useChartSettings>;
