import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import type { ChartSettings } from "./useChartSettings";

export function ChartSettingsPanel({ settings }: { settings: ChartSettings }) {
  const {
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
  } = settings;
  return (
    <div className="space-y-3 text-[11px]">
      <strong>Personalização do gráfico</strong>
      <div className="grid grid-cols-2 gap-2">
        <label>
          Modo
          <NativeSelect
            className="mt-1 h-8 w-full text-xs"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <NativeSelectOption value="points">Pontos</NativeSelectOption>
            <NativeSelectOption value="histogram">Histograma</NativeSelectOption>
          </NativeSelect>
        </label>
        <label>
          Cor
          <Input
            className="mt-1 h-8 w-full text-xs"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
      </div>
      {mode === "histogram" ? (
        <div className="grid grid-cols-2 gap-2">
          <label>
            Coluna
            <NativeSelect
              className="mt-1 h-8 w-full text-xs"
              value={column}
              onChange={(e) => setColumn(e.target.value as ChartSettings["column"])}
            >
              {["x", "y", "sx", "sy"].map((v) => (
                <NativeSelectOption key={v}>{v}</NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label>
            Métrica
            <NativeSelect
              className="mt-1 h-8 w-full text-xs"
              value={metric}
              onChange={(e) => setMetric(e.target.value as ChartSettings["metric"])}
            >
              <NativeSelectOption value="count">Contagem</NativeSelectOption>
              <NativeSelectOption value="percent">Percentual</NativeSelectOption>
              <NativeSelectOption value="density">Densidade</NativeSelectOption>
              <NativeSelectOption value="cumulative">Cumulativa</NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            Bins (0 = auto)
            <Input
              className="mt-1 h-8 w-full text-xs"
              type="number"
              min="0"
              max="100"
              value={bins}
              onChange={(e) => setBins(Math.max(0, Math.min(100, Number(e.target.value))))}
            />
          </label>
          <label>
            Opacidade
            <Slider
              className="mt-3"
              min={0.1}
              max={1}
              step={0.1}
              value={[opacity]}
              onValueChange={([value]) => setOpacity(value)}
              aria-label="Opacidade"
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label>
            Símbolo
            <NativeSelect
              className="mt-1 h-8 w-full text-xs"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              <NativeSelectOption value="circle">Círculo</NativeSelectOption>
              <NativeSelectOption value="square">Quadrado</NativeSelectOption>
              <NativeSelectOption value="diamond">Losango</NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            Tamanho
            <Input
              className="mt-1 h-8 w-full text-xs"
              type="number"
              min="1"
              max="10"
              value={radius}
              onChange={(e) => setRadius(Math.max(1, Math.min(10, Number(e.target.value))))}
            />
          </label>
          <label>
            Linha
            <NativeSelect
              className="mt-1 h-8 w-full text-xs"
              value={lineStyle}
              onChange={(e) => setLineStyle(e.target.value)}
            >
              <NativeSelectOption value="solid">Contínua</NativeSelectOption>
              <NativeSelectOption value="dashed">Tracejada</NativeSelectOption>
              <NativeSelectOption value="dotted">Pontilhada</NativeSelectOption>
              <NativeSelectOption value="dashdot">Traço-ponto</NativeSelectOption>
            </NativeSelect>
          </label>
          <label>
            Espessura
            <Input
              className="mt-1 h-8 w-full text-xs"
              type="number"
              min="1"
              max="10"
              value={lineWidth}
              onChange={(e) => setLineWidth(Math.max(1, Math.min(10, Number(e.target.value))))}
            />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {[
          ["X mínimo", xMin, setXMin],
          ["X máximo", xMax, setXMax],
          ["Y mínimo", yMin, setYMin],
          ["Y máximo", yMax, setYMax],
        ].map(([name, value, setter]) => (
          <label key={name as string}>
            {name as string}
            <Input
              className="mt-1 h-8 w-full text-xs"
              type="number"
              placeholder="Auto"
              value={value as string}
              onChange={(e) => (setter as (s: string) => void)(e.target.value)}
            />
          </label>
        ))}
        <label>
          Divisões
          <Input
            className="mt-1 h-8 w-full text-xs"
            type="number"
            min="2"
            max="20"
            value={ticks}
            onChange={(e) => setTicks(Math.max(2, Math.min(20, Number(e.target.value))))}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["X logarítmico", xLog, setXLog],
          ["Y logarítmico", yLog, setYLog],
          ["Grade", grid, setGrid],
          ["Legenda", legend, setLegend],
          ["Mostrar dados", visible, setVisible],
        ].map(([name, value, setter]) => (
          <label key={name as string}>
            <Checkbox
              checked={value as boolean}
              onCheckedChange={(checked) => (setter as (v: boolean) => void)(checked === true)}
            />{" "}
            {name as string}
          </label>
        ))}
      </div>
      <p>
        Escalas logarítmicas exibem somente valores positivos. Limites inválidos usam escala
        automática.
      </p>
    </div>
  );
}
