/**
 * @module
 * Analysis workspace and its project editing state.
 */

import { FinderProjectDialog } from "@/features/projects/FinderProjectDialog";
import { Button } from "@/components/ui/button";
import { useProjectSave } from "@/features/projects/useProjectSave";
import type { OpenProject } from "@/features/projects/project-client";
import { useLayoutEffect, useRef, useState, type SetStateAction } from "react";
import { FitControls } from "./fit/FitControls";
import { defaultFitConfig, validateFitConfig, type FitConfig } from "./fit/fit-config";
import { ResultsPanel } from "./fit/ResultsPanel";
import { mockFitService, type FitResponse } from "./fit/fit-service";
import { textParser, type SeparatorType } from "./data-import/text-data-parser";
import { SeparatorDialog } from "./data-import/SeparatorDialog";
import { SeparatorSelect } from "./data-import/SeparatorSelect";
import {
  MAX_IMPORT_BYTES,
  readClipboardText,
  ClipboardReadError,
} from "./clipboard/read-clipboard-text";
import { useClipboardShortcuts, type ClipboardShortcut } from "./clipboard/clipboard-shortcuts";
import { Chart, type ChartSeries } from "@/components/chart/Chart";
import { DataTableDialog } from "./DataTableDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChartExportMenu } from "@/components/chart/ChartExportMenu";
import { ChartSettingsPanel } from "@/components/chart/ChartSettingsPanel";
import { useChartSettings, type ChartValues } from "@/components/chart/useChartSettings";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  Activity,
  ArrowLeft,
  Check,
  CircleAlert,
  Save,
  Database,
  FileInput,
  FlaskConical,
  Palette,
  PanelLeft,
  Plus,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  RefreshCw,
} from "lucide-react";

type Dataset = ChartSeries & {
  data: MockAnalysis | null;
  equation: string;
  parameters: string;
  minX: string;
  maxX: string;
  useSx: boolean;
  useSy: boolean;
  fitState: "idle" | "mock" | "error";
  fitError?: string;
  result?: FitResponse;
};

type MockAnalysis = {
  slope: number;
  intercept: number;
  r_squared: number;
  x: number[];
  y: number[];
};

/** Parsed data that is readable but invalid, so a different separator cannot fix it. */
class DataValidationError extends Error {}

/** Where imported text goes: a new dataset or the data of an existing one. */
type ImportTarget = { kind: "create" } | { kind: "replace"; id: string };

/** Text whose parsing failed and that waits for the user to choose a separator. */
type PendingImport = { name: string; text: string; target: ImportTarget; error: string };

const CLIPBOARD_NAME = "Dados colados do clipboard";

/**
 * Parses text into points and checks that values and uncertainties are usable.
 * @param text - Delimited text.
 * @param separator - Selected or automatic separator.
 * @returns The parsed points.
 * @throws {DataValidationError} When values are not finite or uncertainties are negative.
 * @throws {Error} When the text cannot be parsed with the separator.
 */
function parseValidPoints(text: string, separator: SeparatorType) {
  const points = textParser.parse(text, { separator });
  if (
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        !Number.isFinite(p.sx ?? 0) ||
        !Number.isFinite(p.sy ?? 0) ||
        (p.sx ?? 0) < 0 ||
        (p.sy ?? 0) < 0,
    )
  ) {
    throw new DataValidationError(
      "Os dados devem ser finitos e as incertezas não podem ser negativas.",
    );
  }
  return points;
}

type AnalysisState = {
  chart?: ChartValues;
  selectedId?: string | null;
  tableId?: string | null;
  separator?: SeparatorType;
};

/**
 * Renders the analysis workspace and coordinates project editing.
 * @param props - Current project, navigation callback, and Finder opening state and callbacks.
 * @returns The rendered React element.
 */
export function AnalysisPage({
  onBack,
  project = null,
  finderPath,
  projectError,
  onOpenFinderProject,
  onCancelFinderProject,
}: {
  onBack: () => void;
  project?: OpenProject | null;
  finderPath: string | null;
  projectError: string;
  onOpenFinderProject: (path: string) => Promise<void>;
  onCancelFinderProject: () => void;
}) {
  const [initialAnalysis] = useState(() =>
    project
      ? (project.snapshot.analyses[0] ?? {
          id: crypto.randomUUID(),
          kind: "analysis",
          state: {},
          datasets: [],
        })
      : undefined,
  );
  const initial = initialAnalysis?.state as AnalysisState | undefined;
  const chartSettings = useChartSettings(initial?.chart);
  const graphicRef = useRef<HTMLDivElement>(null);
  const exampleNumber = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const sidebarContent = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef({ analysis: 0, visual: 0 });
  const [openingFinderProject, setOpeningFinderProject] = useState(false);
  const openingFinderRef = useRef(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tableId, setTableId] = useState<string | null>(initial?.tableId ?? null);
  const [separator, setSeparator] = useState<SeparatorType>(initial?.separator ?? "auto");
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const modifier = isMac ? "⌘" : "Ctrl";
  const [datasets, setDatasets] = useState<Dataset[]>(
    () =>
      initialAnalysis?.datasets.map(({ id, name, points, state }) => ({
        ...defaultFitConfig,
        data: null,
        linePoints: [],
        color: "#f25a3c",
        radius: 5,
        symbol: "circle",
        lineStyle: "solid",
        lineWidth: 2,
        visible: true,
        fitState: "idle",
        ...(state as Partial<Omit<Dataset, "id" | "name" | "points">>),
        id,
        name,
        points: points.map(({ x, y, sx, sy }) => ({
          x,
          y,
          sx: sx ?? undefined,
          sy: sy ?? undefined,
        })),
      })) ?? [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(initial?.selectedId ?? null);
  const selected = datasets.find((item) => item.id === selectedId) ?? datasets[0];
  const data = selected;
  const saving = useProjectSave(
    project,
    JSON.stringify(
      initialAnalysis
        ? [
            {
              ...initialAnalysis,
              state: { chart: chartSettings, selectedId, tableId, separator },
              datasets: datasets.map(({ id, name, points, ...state }) => ({
                id,
                name,
                points,
                state,
              })),
            },
            ...(project?.snapshot.analyses.slice(1) ?? []),
          ]
        : [],
    ),
  );
  function updateSeries(id: string, updates: Partial<ChartSeries>) {
    setDatasets((items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }
  const seriesSettings = (selected: ChartSeries) => ({
    ...chartSettings,
    color: selected.color,
    radius: selected.radius,
    symbol: selected.symbol,
    lineStyle: selected.lineStyle,
    lineWidth: selected.lineWidth,
    visible: selected.visible,
    setColor: (value: SetStateAction<string>) =>
      updateSeries(selected.id, {
        color: typeof value === "function" ? value(selected.color) : value,
      }),
    setRadius: (value: SetStateAction<number>) =>
      updateSeries(selected.id, {
        radius: typeof value === "function" ? value(selected.radius) : value,
      }),
    setSymbol: (value: SetStateAction<string>) =>
      updateSeries(selected.id, {
        symbol: typeof value === "function" ? value(selected.symbol) : value,
      }),
    setLineStyle: (value: SetStateAction<ChartSeries["lineStyle"]>) =>
      updateSeries(selected.id, {
        lineStyle: typeof value === "function" ? value(selected.lineStyle) : value,
      }),
    setLineWidth: (value: SetStateAction<number>) =>
      updateSeries(selected.id, {
        lineWidth: typeof value === "function" ? value(selected.lineWidth) : value,
      }),
    setVisible: (value: SetStateAction<boolean>) =>
      updateSeries(selected.id, {
        visible: typeof value === "function" ? value(selected.visible) : value,
      }),
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [panelOpen, setPanelOpen] = useState(true);
  const [mode, setMode] = useState<"analysis" | "visual">("analysis");
  const [highlightedSeriesId, setHighlightedSeriesId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useLayoutEffect(() => {
    if (sidebarContent.current) sidebarContent.current.scrollTop = scrollPositions.current[mode];
  }, [mode, panelOpen]);

  /**
   * Applies parsed text to a new dataset or to the data of an existing one.
   * Replacing keeps the fit configuration and clears the previous fit output.
   * @throws When the text cannot be parsed or its values are invalid.
   */
  function commitImport(name: string, text: string, target: ImportTarget, sep: SeparatorType) {
    const points = parseValidPoints(text, sep);
    if (target.kind === "replace") {
      setDatasets((items) =>
        items.map((item) =>
          item.id === target.id
            ? {
                ...item,
                points,
                linePoints: [],
                data: null,
                fitState: "idle",
                fitError: undefined,
                result: undefined,
              }
            : item,
        ),
      );
      return;
    }
    const id = crypto.randomUUID();
    setDatasets((items) => [
      ...items,
      {
        id,
        name,
        data: null,
        ...defaultFitConfig,
        fitState: "idle",
        points,
        linePoints: [],
        color: ["#f25a3c", "#364cff", "#16835d", "#a04cb0"][items.length % 4],
        radius: 5,
        symbol: "circle",
        lineStyle: "solid",
        lineWidth: 2,
        visible: true,
      },
    ]);
    setSelectedId(id);
  }

  /** Runs an import and describes the failure, if any; `validation` failures skip the dialog. */
  function tryImport(name: string, text: string, target: ImportTarget, sep: SeparatorType) {
    try {
      commitImport(name, text, target, sep);
      return null;
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : "Não foi possível importar.",
        validation: error instanceof DataValidationError,
      };
    }
  }

  /** Reads files, enforcing the size limit, and imports each one with the selected separator. */
  async function readImportFile(file: File) {
    if (file.size > MAX_IMPORT_BYTES) throw new Error("O arquivo excede 1 MB.");
    return file.text();
  }

  async function importFiles(files: FileList | null) {
    if (!files) return;
    const errors: string[] = [];
    const queue: PendingImport[] = [];
    for (const file of Array.from(files)) {
      const target: ImportTarget = { kind: "create" };
      try {
        const text = await readImportFile(file);
        const failure = tryImport(file.name, text, target, separator);
        if (!failure) continue;
        if (failure.validation) errors.push(`${file.name}: ${failure.message}`);
        else queue.push({ name: file.name, text, target, error: failure.message });
      } catch (error) {
        errors.push(
          `${file.name}: ${error instanceof Error ? error.message : "Não foi possível importar."}`,
        );
      }
    }
    setImportNotice("");
    setImportError(errors.join(" "));
    if (queue.length) setPendingImports((items) => [...items, ...queue]);
  }

  async function replaceData(file: File | undefined, targetId: string) {
    if (!file) return;
    const target: ImportTarget = { kind: "replace", id: targetId };
    try {
      const text = await readImportFile(file);
      const failure = tryImport(file.name, text, target, separator);
      setImportNotice("");
      if (failure && !failure.validation) {
        setImportError("");
        setPendingImports((items) => [
          ...items,
          { name: file.name, text, target, error: failure.message },
        ]);
      } else setImportError(failure?.message ?? "");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Não foi possível substituir os dados.",
      );
    }
  }

  /** Imports clipboard text as a new dataset or into dataset N (1-based) of the list. */
  async function importFromClipboard(shortcut: ClipboardShortcut) {
    let target: ImportTarget = { kind: "create" };
    let replaced: ChartSeries | undefined;
    if (shortcut.kind === "replace") {
      replaced = datasets[shortcut.index - 1];
      if (!replaced) {
        setImportNotice("");
        setImportError(`Não há conjunto de dados ${shortcut.index}.`);
        return;
      }
      target = { kind: "replace", id: replaced.id };
    }
    let text: string;
    try {
      text = await readClipboardText();
    } catch (error) {
      setImportNotice("");
      setImportError(
        error instanceof ClipboardReadError
          ? error.message
          : "Não foi possível ler a área de transferência.",
      );
      return;
    }
    const failure = tryImport(CLIPBOARD_NAME, text, target, separator);
    setImportNotice("");
    if (!failure) {
      setImportError("");
      setImportNotice(
        replaced
          ? `Dados do conjunto ${shortcut.kind === "replace" ? shortcut.index : ""} ("${replaced.name}") substituídos com sucesso.`
          : "Dados colados importados com sucesso.",
      );
    } else if (failure.validation) {
      setImportError(`${CLIPBOARD_NAME}: ${failure.message}`);
    } else {
      setImportError("");
      setPendingImports((items) => [
        ...items,
        { name: CLIPBOARD_NAME, text, target, error: failure.message },
      ]);
    }
  }

  /** Retries the first pending import with the separator chosen in the dialog. */
  function retryPendingImport(sep: SeparatorType) {
    const current = pendingImports[0];
    if (!current) return;
    const failure = tryImport(current.name, current.text, current.target, sep);
    if (!failure) {
      setPendingImports((items) => items.slice(1));
      setImportError("");
      setImportNotice(`Dados de "${current.name}" importados com sucesso.`);
    } else if (failure.validation) {
      setPendingImports((items) => items.slice(1));
      setImportNotice("");
      setImportError(`${current.name}: ${failure.message}`);
    } else {
      setPendingImports((items) => [{ ...items[0], error: failure.message }, ...items.slice(1)]);
    }
  }

  async function runFits() {
    const configured = datasets.filter((item) => item.equation.trim());
    const results = await Promise.all(
      configured.map(async (item) => {
        try {
          const validationError = validateFitConfig(item);
          if (validationError) throw new Error(validationError);
          const response = await mockFitService.fit({
            version: 1,
            points: item.points,
            equation: item.equation,
            parameters: item.parameters,
            range: {
              min: item.minX === "" ? undefined : Number(item.minX),
              max: item.maxX === "" ? undefined : Number(item.maxX),
            },
            useSx: item.useSx,
            useSy: item.useSy,
          });
          return { item, response, error: undefined };
        } catch (error) {
          return {
            item,
            response: undefined,
            error: error instanceof Error ? error.message : "Falha na simulação.",
          };
        }
      }),
    );
    setDatasets((items) =>
      items.map((current) => {
        const result = results.find(
          ({ item }) =>
            item.id === current.id &&
            item.points === current.points &&
            item.equation === current.equation &&
            item.parameters === current.parameters &&
            item.minX === current.minX &&
            item.maxX === current.maxX &&
            item.useSx === current.useSx &&
            item.useSy === current.useSy,
        );
        if (!result) return current;
        return {
          ...current,
          linePoints: result.response?.curve ?? [],
          fitState: result.response ? "mock" : "error",
          fitError: result.error,
          result: result.response,
        };
      }),
    );
  }

  function updateFit(id: string, changes: Partial<FitConfig>) {
    setDatasets((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...changes,
              linePoints: [],
              fitState: "idle",
              fitError: undefined,
              result: undefined,
            }
          : item,
      ),
    );
  }

  async function loadExample() {
    if (!isTauri()) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const example = await invoke<MockAnalysis>("get_mock_analysis");
      const id = crypto.randomUUID();
      const name = `Exemplo ${++exampleNumber.current}`;
      setDatasets((items) => [
        ...items,
        {
          id,
          name,
          data: example,
          ...defaultFitConfig,
          fitState: "idle",
          points: example.x.map((x, index) => ({ x, y: example.y[index] })),
          linePoints: example.x.length
            ? [Math.min(...example.x), Math.max(...example.x)].map((x) => ({
                x,
                y: example.slope * x + example.intercept,
              }))
            : [],
          color: ["#f25a3c", "#364cff", "#16835d", "#a04cb0"][items.length % 4],
          radius: 5,
          symbol: "circle",
          lineStyle: "solid",
          lineWidth: 2,
          visible: true,
        },
      ]);
      setSelectedId(id);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const cards = (cardMode: "analysis" | "visual") => (
    <div className="mt-4 space-y-3">
      {datasets.map((item, index) => {
        const flat = datasets.length === 1;
        const open = flat || (expanded[item.id] ?? true);
        const saveName = () => {
          const name = renameValue.trim();
          if (name) updateSeries(item.id, { name });
          setRenamingId(null);
        };
        return (
          <div
            key={item.id}
            className={flat ? "" : "overflow-hidden rounded-lg border bg-white"}
            style={flat ? undefined : { borderColor: item.color }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2.5"
              style={
                flat
                  ? undefined
                  : { backgroundColor: `color-mix(in srgb, ${item.color} 4%, white)` }
              }
            >
              {index < 9 && (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-semibold"
                  style={{ borderColor: item.color, color: item.color }}
                >
                  {index + 1}
                </span>
              )}
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {renamingId === item.id && cardMode === "analysis" ? (
                <input
                  aria-label="Renomear conjunto"
                  autoFocus
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={saveName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveName();
                    if (event.key === "Escape") {
                      setRenamingId(null);
                    }
                  }}
                  className="h-8 min-w-0 flex-1 rounded border border-[#d8ded7] bg-white px-2 text-sm"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!flat) setExpanded((old) => ({ ...old, [item.id]: !open }));
                  }}
                  aria-expanded={flat ? undefined : open}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium" title={item.name}>
                    {item.name}
                  </span>
                  <span className="block text-xs text-[#87938a]">{item.points.length} linhas</span>
                </button>
              )}
              {cardMode === "analysis" && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Ações de ${item.name}`}
                        className="rounded p-1 text-[#66716e] hover:bg-[#e9ece7]"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem
                        onSelect={() => {
                          setTableId(item.id);
                        }}
                      >
                        <Eye />
                        Ver tabela
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenameValue(item.name);
                          setRenamingId(item.id);
                        }}
                      >
                        <Pencil />
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => document.getElementById(`replace-${item.id}`)?.click()}
                      >
                        <RefreshCw />
                        Substituir dados
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setDatasets((items) => items.filter((entry) => entry.id !== item.id));
                          if (selectedId === item.id) {
                            setSelectedId(null);
                          }
                        }}
                      >
                        <Trash2 />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <input
                    id={`replace-${item.id}`}
                    type="file"
                    accept=".csv,.txt,.dat"
                    className="hidden"
                    onChange={(event) => {
                      void replaceData(event.target.files?.[0], item.id);
                      event.target.value = "";
                    }}
                  />
                </>
              )}
              {!flat && (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={open ? `Recolher ${item.name}` : `Expandir ${item.name}`}
                  onClick={() => setExpanded((old) => ({ ...old, [item.id]: !open }))}
                  className="rounded p-1 text-[#66716e]"
                >
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
            </div>
            {open &&
              (cardMode === "analysis" ? (
                <div className={`border-t border-[#e0e5df] py-3.5 ${flat ? "px-0" : "px-3.5"}`}>
                  <FitControls
                    name={item.name}
                    config={item}
                    onChange={(changes) => updateFit(item.id, changes)}
                  />
                </div>
              ) : (
                <div className={flat ? "pb-3" : "px-3 pb-3"}>
                  <ChartSettingsPanel settings={seriesSettings(item)} section="series" />
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
  const table = datasets.find((item) => item.id === tableId);
  useClipboardShortcuts(
    (shortcut) => void importFromClipboard(shortcut),
    isMac,
    pendingImports.length === 0 && !table && finderPath === null,
  );

  return (
    <div className="analysis-workspace flex h-screen min-h-0 bg-[#f7f7f3] text-[#20272c]">
      {pendingImports[0] && (
        <SeparatorDialog
          key={`${pendingImports[0].name}:${pendingImports[0].text.length}`}
          name={pendingImports[0].name}
          error={pendingImports[0].error}
          initialSeparator={separator}
          onRetry={retryPendingImport}
          onCancel={() => setPendingImports((items) => items.slice(1))}
        />
      )}
      <FinderProjectDialog
        path={finderPath}
        opening={openingFinderProject}
        onCancel={onCancelFinderProject}
        onOpen={(path) => {
          if (openingFinderRef.current) return;
          openingFinderRef.current = true;
          setOpeningFinderProject(true);
          void (async () => {
            try {
              if (await saving.canLeave()) await onOpenFinderProject(path);
            } finally {
              openingFinderRef.current = false;
              setOpeningFinderProject(false);
            }
          })();
        }}
      />
      {projectError && (
        <p
          role="alert"
          className="fixed right-4 top-4 z-40 max-w-sm rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-md"
        >
          {projectError}
        </p>
      )}
      <DataTableDialog dataset={table ?? null} onClose={() => setTableId(null)} />
      {panelOpen && (
        <aside className="analysis-panel flex h-full w-[360px] shrink-0 flex-col border-r border-[#d8ded7] bg-[#f7f8f5]">
          <header className="border-b border-border bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  void saving.canLeave().then((ok) => {
                    if (ok) onBack();
                  });
                }}
                aria-label="Voltar ao início"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm leading-5 font-semibold">
                  {saving.project?.snapshot.name ?? "Projeto sem título"}
                </h1>
                <p
                  role="status"
                  className={`flex items-center gap-1.5 text-[11px] ${saving.error ? "text-red-800" : "text-muted-foreground"}`}
                >
                  {saving.error ? (
                    <CircleAlert aria-hidden="true" size={12} />
                  ) : saving.status === "Salvo" && saving.project ? (
                    <Check aria-hidden="true" size={12} className="text-ring" />
                  ) : null}
                  {saving.project ? saving.status : "Não salvo"}
                </p>
              </div>
              {saving.project && !saving.usesNativeMenu && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="bg-white"
                      aria-label="Comandos do projeto"
                      title="Comandos do projeto"
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void saving.flush()}>
                      <Save aria-hidden="true" /> Salvar projeto
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void saving.saveAs()}>
                      <FileInput aria-hidden="true" /> Salvar como…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {saving.error && (
              <p
                role="alert"
                className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
              >
                {saving.error}
              </p>
            )}
          </header>
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
          <div
            ref={sidebarContent}
            onScroll={(event) => {
              scrollPositions.current[mode] = event.currentTarget.scrollTop;
            }}
            className="min-h-0 flex-1 overflow-auto overscroll-contain p-5"
          >
            {mode === "analysis" ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                    <Database size={16} className="text-[#758078]" /> Dados{" "}
                    {data && (
                      <span className="rounded bg-[#e9ece7] px-1.5 text-[10px] text-[#66716e]">
                        {datasets.length}
                      </span>
                    )}
                  </h2>
                  <div className="flex gap-1 text-[#a4aea6]">
                    <SeparatorSelect
                      label="Separador de importação"
                      value={separator}
                      onChange={setSeparator}
                    />
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept=".csv,.txt,.dat"
                      className="hidden"
                      onChange={(event) => {
                        void importFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      aria-label="Adicionar dados"
                      className="p-1.5 text-[#66716e]"
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
                      Arquivos CSV, TXT ou DAT, com até 1 MB cada.
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-[#87938a]">
                      <kbd className="font-sans font-semibold">{modifier} B</kbd> adiciona do
                      clipboard e <kbd className="font-sans font-semibold">{modifier} 1–9</kbd>{" "}
                      substitui o conjunto.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="mt-4 rounded border border-[#cbd4ca] bg-white px-3 py-2 text-[12px] font-medium text-[#35443a] hover:bg-[#f4f6f3] disabled:opacity-50"
                    >
                      Selecionar arquivos
                    </button>
                  </div>
                ) : (
                  cards("analysis")
                )}
                {importError && (
                  <p role="alert" className="mt-3 text-[12px] text-[#a43d35]">
                    {importError}
                  </p>
                )}
                <p
                  role="status"
                  data-testid="import-notice"
                  className="mt-3 text-[12px] text-[#35443a] empty:hidden"
                >
                  {importNotice}
                </p>
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
                <div className="mt-4">
                  {cards("visual")}
                  <ChartSettingsPanel settings={chartSettings} section="chart" />
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-[#d8ded7] p-4">
            <button
              type="button"
              disabled={!datasets.some((item) => item.equation.trim())}
              onClick={() => void runFits()}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-[12px] font-semibold text-primary-foreground disabled:opacity-45"
            >
              <Activity size={16} /> Executar ajustes
            </button>
            <p className="mt-2 text-center text-[10px] text-[#87938a]">
              Simulação: nenhum ajuste científico é calculado
            </p>
            {datasets
              .filter((item) => item.fitState === "error")
              .map((item) => (
                <p key={item.id} role="alert" className="mt-2 text-[11px] text-[#a43d35]">
                  {item.name}: {item.fitError}
                </p>
              ))}
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
          <ChartExportMenu graphic={graphicRef} disabled={!data} />
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
                  <p className="mt-1 text-[11px] text-[#87938a]">CSV, TXT ou DAT</p>
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
              <Chart
                graphicRef={graphicRef}
                settings={chartSettings}
                label="Gráfico dos conjuntos de dados"
                series={datasets}
                highlightedSeriesId={highlightedSeriesId}
              />
              {datasets.some((item) => item.data) && (
                <p className="mt-2 text-[11px] text-[#8a6a38]">
                  Exemplo demonstrativo: nenhum ajuste foi executado.
                </p>
              )}
              <ResultsPanel
                results={datasets.flatMap((item) =>
                  item.result
                    ? [{ id: item.id, name: item.name, color: item.color, result: item.result }]
                    : [],
                )}
                onHighlight={setHighlightedSeriesId}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
