import { useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  Activity,
  ArrowLeft,
  ChartNoAxesCombined,
  Database,
  FileInput,
  FlaskConical,
  Palette,
  PanelLeft,
  Plus,
  Settings2,
} from "lucide-react";

type MockAnalysis = {
  slope: number;
  intercept: number;
  r_squared: number;
  x: number[];
  y: number[];
};
const format = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);

export function AnalysisPage({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<MockAnalysis | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [panelOpen, setPanelOpen] = useState(true);
  const [mode, setMode] = useState<"analysis" | "visual">("analysis");
  const [detailsOpen, setDetailsOpen] = useState(true);

  async function loadExample() {
    if (!isTauri()) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      setData(await invoke<MockAnalysis>("get_mock_analysis"));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="analysis-workspace flex h-screen min-h-0 bg-[#f7f7f3] text-[#20272c]">
      {panelOpen && (
        <aside className="analysis-panel flex h-full w-[360px] shrink-0 flex-col border-r border-[#d8ded7] bg-[#f7f8f5]">
          <div className="flex h-[70px] shrink-0 items-center gap-3 border-b border-[#d8ded7] px-4">
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar ao início"
              className="rounded p-2 text-[#66716e] hover:bg-[#e9ece7]"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-[#87938a]">Projeto</span>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-semibold">Projeto sem título</h1>
                <span className="rounded bg-[#fff3dc] px-1.5 py-0.5 text-[9px] font-semibold text-[#8c601d]">
                  NÃO SALVO
                </span>
              </div>
            </div>
          </div>
          <div className="border-b border-[#d8ded7] px-4 py-3">
            <div
              role="tablist"
              aria-label="Modo de trabalho"
              className="flex gap-1 rounded-md bg-[#e9ece7] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "analysis"}
                onClick={() => setMode("analysis")}
                className={`flex flex-1 items-center justify-center gap-2 rounded px-2 py-2 text-[12px] font-medium ${mode === "analysis" ? "bg-white text-[#20272c] shadow-sm" : "text-[#758078]"}`}
              >
                <Activity size={15} /> Análise
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "visual"}
                onClick={() => setMode("visual")}
                className={`flex flex-1 items-center justify-center gap-2 rounded px-2 py-2 text-[12px] font-medium ${mode === "visual" ? "bg-white text-[#20272c] shadow-sm" : "text-[#758078]"}`}
              >
                <Palette size={15} /> Personalização
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            {mode === "analysis" ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <Database size={16} className="text-[#758078]" /> Dados{" "}
                    {data && (
                      <span className="rounded bg-[#e9ece7] px-1.5 text-[10px] text-[#66716e]">
                        1
                      </span>
                    )}
                  </h2>
                  <div className="flex gap-1 text-[#a4aea6]">
                    <button
                      type="button"
                      disabled
                      aria-label="Opções de importação em desenvolvimento"
                      className="p-1.5"
                    >
                      <Settings2 size={15} />
                    </button>
                    <button
                      type="button"
                      disabled
                      aria-label="Adicionar dados em desenvolvimento"
                      className="p-1.5"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                {!data ? (
                  <div className="mt-4 rounded-lg border border-dashed border-[#c8d0c8] bg-white px-4 py-6 text-center">
                    <FileInput size={22} className="mx-auto text-[#829087]" />
                    <p className="mt-3 text-[12px] font-semibold">Importar dados</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#87938a]">
                      A importação de arquivos ainda está em desenvolvimento.
                    </p>
                    <button
                      type="button"
                      onClick={loadExample}
                      disabled={status === "loading"}
                      className="mt-4 rounded border border-[#cbd4ca] bg-white px-3 py-2 text-[12px] font-medium text-[#35443a] hover:bg-[#f4f6f3] disabled:opacity-50"
                    >
                      {status === "loading" ? "Carregando…" : "Carregar exemplo C++"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setDetailsOpen(!detailsOpen)}
                      aria-expanded={detailsOpen}
                      className="flex w-full items-center gap-2 rounded-md border border-[#d8ded7] bg-white px-3 py-3 text-left"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#f25a3c]" />
                      <span className="flex-1 text-[12px] font-semibold">Conjunto de exemplo</span>
                      <span className="text-[11px] text-[#87938a]">
                        {data.x.length} pontos {detailsOpen ? "−" : "+"}
                      </span>
                    </button>
                    {detailsOpen && (
                      <div className="space-y-5 px-1 pt-5">
                        <div>
                          <p className="text-[12px] font-semibold">Visualização</p>
                          <label className="mt-3 block text-[11px] font-medium text-[#66716e]">
                            Modo
                          </label>
                          <div className="mt-1.5 rounded border border-[#d8ded7] bg-white px-3 py-2 text-[12px] text-[#66716e]">
                            Pontos
                          </div>
                        </div>
                        <div className="border-t border-[#e0e5df] pt-4">
                          <p className="text-[12px] font-semibold">Modelo</p>
                          <label className="mt-3 block text-[11px] font-medium text-[#66716e]">
                            Função de ajuste
                          </label>
                          <div className="mt-1.5 rounded border border-[#d8ded7] bg-[#f1f3ef] px-3 py-2 font-mono text-[12px] text-[#66716e]">
                            a * x + b
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-[#87938a]">
                            Modelo demonstrativo. A configuração de ajustes ainda não está
                            disponível.
                          </p>
                        </div>
                        <div className="border-t border-[#e0e5df] pt-4">
                          <p className="text-[12px] font-semibold">Dados de exemplo</p>
                          <table className="mt-2 w-full text-left text-[11px]">
                            <thead className="text-[#87938a]">
                              <tr>
                                <th className="py-2 font-medium">Ponto</th>
                                <th className="font-medium">x</th>
                                <th className="font-medium">y</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.x.map((x, i) => (
                                <tr key={i} className="border-t border-[#e8ece7]">
                                  <td className="py-2 text-[#87938a]">{i + 1}</td>
                                  <td>{format(x)}</td>
                                  <td>{format(data.y[i])}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {status === "error" && (
                  <p role="alert" className="mt-3 text-[12px] leading-5 text-[#a43d35]">
                    Não foi possível carregar o exemplo. Abra o aplicativo desktop e tente
                    novamente.
                  </p>
                )}
              </>
            ) : (
              <div>
                <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                  <Palette size={16} /> Personalização
                </h2>
                <p className="mt-3 text-[12px] leading-5 text-[#87938a]">
                  A personalização do gráfico estará disponível em uma próxima etapa.
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-[#d8ded7] p-4">
            <button
              type="button"
              disabled
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#20272c] px-4 text-[12px] font-semibold text-white opacity-45"
            >
              <Activity size={16} /> Executar ajustes
            </button>
            <p className="mt-2 text-center text-[10px] text-[#87938a]">
              Ajustes científicos ainda não disponíveis
            </p>
          </div>
        </aside>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-[54px] shrink-0 items-center gap-3 border-b border-[#d8ded7] bg-white px-4">
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-label={panelOpen ? "Ocultar painel" : "Mostrar painel"}
            aria-expanded={panelOpen}
            className="rounded p-2 text-[#66716e] hover:bg-[#eff2ed]"
          >
            <PanelLeft size={17} />
          </button>
          <span className="text-[12px] font-semibold">Gráfico</span>
          <span className="ml-auto rounded border border-[#e8d6b2] bg-[#fff8ea] px-2 py-1 text-[10px] font-semibold text-[#896022]">
            DEMONSTRAÇÃO
          </span>
        </div>
        <div
          className={`analysis-canvas relative flex min-h-0 flex-1 ${data ? "overflow-hidden p-0" : "items-center justify-center overflow-auto px-6 py-8"}`}
        >
          {!data ? (
            <div className="relative w-full max-w-[620px] text-center">
              <h2 className="text-[18px] font-semibold">Comece sua análise</h2>
              <p className="mt-1.5 text-[13px] text-[#758078]">
                Importe seus dados para visualizar o gráfico e calcular ajustes.
              </p>
              <div className="mt-6 grid gap-3 rounded-xl border border-dashed border-[#c8d0c8] bg-white p-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[#e1e6df] bg-[#f8faf7] p-5">
                  <Database size={22} className="mx-auto text-[#607568]" />
                  <h3 className="mt-3 text-[13px] font-semibold">Importar no painel Dados</h3>
                  <p className="mt-1 text-[11px] text-[#87938a]">Importação disponível em breve</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelOpen(true);
                      setMode("analysis");
                    }}
                    className="mt-4 rounded border border-[#d8ded7] bg-white px-3 py-2 text-[11px] font-medium"
                  >
                    Abrir painel de dados
                  </button>
                </div>
                <div className="rounded-lg border border-[#e1e6df] bg-[#f8faf7] p-5">
                  <FlaskConical size={22} className="mx-auto text-[#607568]" />
                  <h3 className="mt-3 text-[13px] font-semibold">Explorar demonstração</h3>
                  <p className="mt-1 text-[11px] text-[#87938a]">Dados fixos retornados pelo C++</p>
                  <button
                    type="button"
                    onClick={loadExample}
                    disabled={status === "loading"}
                    className="mt-4 rounded border border-[#d8ded7] bg-white px-3 py-2 text-[11px] font-medium hover:bg-[#eff2ed]"
                  >
                    {status === "loading" ? "Carregando…" : "Carregar exemplo"}
                  </button>
                </div>
              </div>
              {status === "error" && (
                <p role="alert" className="mt-3 text-[12px] text-[#a43d35]">
                  Não foi possível carregar o exemplo. Abra o aplicativo desktop e tente novamente.
                </p>
              )}
              <div className="mx-auto mt-6 max-w-[360px] text-left">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-[#9aa59c]">
                  Próximos passos
                </p>
                {[
                  "Importe dados no painel à esquerda",
                  "Escreva a equação de ajuste",
                  "Execute os ajustes e veja os resultados",
                ].map((step, i) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 py-1.5 text-[11px] text-[#929e95]"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e9ece7] text-[10px] font-semibold">
                      {i + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative flex h-full min-h-0 w-full flex-col bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <ChartNoAxesCombined size={16} /> Gráfico de exemplo
                  </h2>
                  <p className="mt-1 text-[11px] text-[#849087]">
                    Pontos e reta retornados como dados fixos.
                  </p>
                </div>
                <span className="text-[10px] font-medium text-[#8b682f]">
                  SEM CÁLCULO CIENTÍFICO
                </span>
              </div>
              <svg
                viewBox="0 0 520 260"
                preserveAspectRatio="none"
                className="mt-4 min-h-0 w-full flex-1"
                role="img"
                aria-label="Gráfico ilustrativo com cinco pontos e uma reta de exemplo"
              >
                <g stroke="#e8ece7" strokeWidth="1">
                  {[35, 85, 135, 185, 235].map((y) => (
                    <line key={y} x1="45" y1={y} x2="495" y2={y} />
                  ))}
                  {[45, 145, 245, 345, 445].map((x) => (
                    <line key={x} x1={x} y1="35" x2={x} y2="235" />
                  ))}
                </g>
                <path d="M45 35V235H495" fill="none" stroke="#aebbb0" />
                <line
                  x1="45"
                  y1={235 - data.intercept * (200 / 6)}
                  x2="445"
                  y2={235 - (4 * data.slope + data.intercept) * (200 / 6)}
                  stroke="#364cff"
                  strokeWidth="2"
                />
                {data.x.map((x, i) => (
                  <circle
                    key={i}
                    cx={45 + x * 100}
                    cy={235 - data.y[i] * 33.333}
                    r="4.5"
                    fill="#f25a3c"
                    stroke="white"
                    strokeWidth="2"
                  />
                ))}
                <text x="490" y="254" fontSize="11" fill="#78857d">
                  x
                </text>
                <text x="26" y="35" fontSize="11" fill="#78857d">
                  y
                </text>
                {[0, 1, 2, 3, 4].map((n) => (
                  <text
                    key={n}
                    x={45 + n * 100}
                    y="252"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#78857d"
                  >
                    {n}
                  </text>
                ))}
                {[0, 1.5, 3, 4.5, 6].map((n, i) => (
                  <text
                    key={n}
                    x="36"
                    y={239 - i * 50}
                    textAnchor="end"
                    fontSize="10"
                    fill="#78857d"
                  >
                    {format(n)}
                  </text>
                ))}
              </svg>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#edf0ec] pt-4 text-[11px] text-[#66716e]">
                <span>
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#f25a3c]" /> Dados
                  de exemplo
                </span>
                <span>
                  <span className="mr-1.5 inline-block h-0.5 w-4 bg-[#364cff] align-middle" /> Reta
                  de exemplo
                </span>
                <span className="ml-auto font-mono">
                  a = {format(data.slope)} · b = {format(data.intercept)} · R² ={" "}
                  {format(data.r_squared)}
                </span>
              </div>
              <p className="mt-3 text-[11px] text-[#8a6a38]">
                Valores demonstrativos fixos: nenhum ajuste foi executado.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
