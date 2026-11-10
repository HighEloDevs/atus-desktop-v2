import { Circle, Diamond, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SettingSwitch } from "@/components/ui/setting-switch";
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
    legendOrientation,
    setLegendOrientation,
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
  } = settings;
  return (
    <div className="space-y-5 text-xs">
      <section className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="font-semibold">Pontos</h3>
          <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">
            Aparência dos marcadores no gráfico.
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
        </div>
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
      </section>

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
          <h3 className="font-semibold">Legenda</h3>
          <span className="mt-1 block leading-relaxed text-muted-foreground">
            Arraste a legenda para movê-la no gráfico.
          </span>
        </div>
        <SettingSwitch label="Mostrar legenda" value={legend} onChange={setLegend} />
        {legend && (
          <>
            <fieldset>
              <legend className="font-medium">Orientação</legend>
              <div className="mt-2 flex gap-2">
                {(["horizontal", "vertical"] as const).map((orientation) => (
                  <label key={orientation} className="flex-1 cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="legend-orientation"
                      checked={legendOrientation === orientation}
                      onChange={() => setLegendOrientation(orientation)}
                    />
                    <span className="flex h-8 items-center justify-center rounded-md border border-input bg-background peer-checked:border-[#364cff] peer-checked:bg-[#364cff] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                      {orientation === "horizontal" ? "Horizontal" : "Vertical"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </section>
      <section className="space-y-3 border-t border-border pt-4">
        <div>
          <h3 className="font-semibold">Exibição</h3>
          <span className="mt-1 block font-normal leading-relaxed text-muted-foreground">
            Escolha os elementos visíveis no gráfico.
          </span>
        </div>
        <div className="space-y-2">
          {([["Linhas de grade", grid, setGrid]] as const).map(([name, value, setter]) => (
            <SettingSwitch key={name} label={name} value={value} onChange={setter} />
          ))}
        </div>
      </section>
    </div>
  );
}
