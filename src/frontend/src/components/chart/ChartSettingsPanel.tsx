import { Circle, Diamond, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SettingSwitch } from "@/components/ui/setting-switch";
import { Slider } from "@/components/ui/slider";
import type { ChartSettings } from "./useChartSettings";

const markerOptions = [
  { value: "circle", label: "Círculo", Icon: Circle },
  { value: "square", label: "Quadrado", Icon: Square },
  { value: "diamond", label: "Losango", Icon: Diamond },
];

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
    column,
    setColumn,
    metric,
    setMetric,
    bins,
    setBins,
    opacity,
    setOpacity,
  } = settings;
  return (
    <div className="space-y-5 text-xs">
      <section className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="font-semibold">{mode === "points" ? "Pontos" : "Histograma"}</h3>
          <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">
            {mode === "points"
              ? "Aparência dos marcadores no gráfico."
              : "Aparência das barras e distribuição dos dados."}
          </span>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="font-medium">Cor</span>
            <span className="mt-1 flex h-8 items-center gap-2 rounded-md border border-input bg-background px-1">
              <Input
                className="h-6 w-8 cursor-pointer border-0 p-0.5 shadow-none"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <span aria-hidden="true" className="font-mono">
                {color.toUpperCase()}
              </span>
            </span>
          </label>
          {mode === "points" && (
            <label className="block">
              <span className="font-medium">Raio (px)</span>
              <Input
                className="mt-1 h-8 w-full text-xs"
                type="number"
                min="1"
                max="10"
                value={radius}
                onChange={(e) => setRadius(Math.max(1, Math.min(10, Number(e.target.value))))}
              />
            </label>
          )}
        </div>
        {mode === "histogram" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="font-medium">Coluna</span>
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
            <label className="block">
              <span className="font-medium">Métrica</span>
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
            <label className="block">
              <span className="font-medium">Classes (0 = auto)</span>
              <Input
                className="mt-1 h-8 w-full text-xs"
                type="number"
                min="0"
                max="100"
                value={bins}
                onChange={(e) => setBins(Math.max(0, Math.min(100, Number(e.target.value))))}
              />
            </label>
            <label className="block">
              <span className="font-medium">Opacidade</span>
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
          <fieldset>
            <legend className="font-medium">Símbolo</legend>
            <div className="mt-2 flex gap-2">
              {markerOptions.map(({ value, label, Icon }) => (
                <label key={value} title={label} className="cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="chart-marker"
                    value={value}
                    checked={symbol === value}
                    onChange={() => setSymbol(value)}
                    aria-label={label}
                  />
                  <span className="flex size-8 items-center justify-center rounded-md border border-input bg-background peer-checked:border-[#364cff] peer-checked:bg-[#364cff] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                    <Icon size={14} fill="currentColor" aria-hidden="true" />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>
      {mode === "points" && (
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Linha de ajuste</h3>
              <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">
                Aparência da curva exibida sobre os pontos.
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="font-medium">Estilo</span>
              <NativeSelect
                className="mt-1 h-8 w-full text-xs"
                value={lineStyle}
                onChange={(e) => setLineStyle(e.target.value as typeof lineStyle)}
              >
                <NativeSelectOption value="solid">Contínua</NativeSelectOption>
                <NativeSelectOption value="dashed">Tracejada</NativeSelectOption>
                <NativeSelectOption value="dotted">Pontilhada</NativeSelectOption>
                <NativeSelectOption value="dashdot">Traço-ponto</NativeSelectOption>
              </NativeSelect>
            </label>
            <label className="block">
              <span className="font-medium">Espessura (px)</span>
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
        </section>
      )}
      <section className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="font-semibold">Eixos</h3>
          <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">
            Defina os intervalos, as divisões e a escala. Campos vazios usam limites automáticos.
          </span>
        </div>
        <div className="space-y-3">
          {(
            [
              { axis: "X", min: xMin, max: xMax, setMin: setXMin, setMax: setXMax },
              { axis: "Y", min: yMin, max: yMax, setMin: setYMin, setMax: setYMax },
            ] as const
          ).map(({ axis, min, max, setMin, setMax }) => (
            <fieldset key={axis}>
              <legend className="font-medium">Intervalo do eixo {axis}</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-muted-foreground">De</span>
                  <Input
                    className="mt-1 h-8 w-full text-xs"
                    type="number"
                    step="any"
                    placeholder="Auto"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-muted-foreground">Até</span>
                  <Input
                    className="mt-1 h-8 w-full text-xs"
                    type="number"
                    step="any"
                    placeholder="Auto"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                  />
                </label>
              </div>
            </fieldset>
          ))}
          <label className="block">
            <span className="font-medium">Divisões</span>
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
        <div className="space-y-2">
          {(
            [
              ["Escala logarítmica no eixo X", xLog, setXLog],
              ["Escala logarítmica no eixo Y", yLog, setYLog],
            ] as const
          ).map(([name, value, setter]) => (
            <SettingSwitch key={name} label={name} value={value} onChange={setter} />
          ))}
        </div>
      </section>
      <section className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="font-semibold">Exibição</h3>
          <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">
            Escolha os elementos visíveis no gráfico.
          </span>
        </div>
        <div className="space-y-2">
          {(
            [
              ["Linhas de grade", grid, setGrid],
              ["Mostrar legenda", legend, setLegend],
            ] as const
          ).map(([name, value, setter]) => (
            <SettingSwitch key={name} label={name} value={value} onChange={setter} />
          ))}
        </div>
      </section>
    </div>
  );
}
