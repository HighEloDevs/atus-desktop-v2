/**
 * @module
 * The quick analysis window: a small panel, opened by a global shortcut, where the person types
 * the fit function and pastes the data. Submitting hands both to the main window, which opens
 * them as a new project and runs the fit.
 */

import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Activity, ClipboardPaste, Trash2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import type { ChartPoint } from "@/components/chart/Chart";
import { DataPointsTable } from "@/features/analysis/DataPointsTable";
import { getClipboardShortcut } from "@/features/analysis/clipboard/clipboard-shortcuts";
import {
  ClipboardReadError,
  readClipboardText,
} from "@/features/analysis/clipboard/read-clipboard-text";
import {
  DataValidationError,
  parseValidPoints,
} from "@/features/analysis/data-import/parse-valid-points";
import { SeparatorSelect } from "@/features/analysis/data-import/SeparatorSelect";
import type { SeparatorType } from "@/features/analysis/data-import/text-data-parser";
import { EquationField } from "@/features/analysis/fit/EquationField";
import { defaultFitConfig, validateFitConfig } from "@/features/analysis/fit/fit-config";
import { resolveFitParameters } from "@/features/analysis/fit/parse-fit-parameters";
import { PointsPreview } from "./PointsPreview";
import { QUICK_SHOWN_EVENT, quickAnalysisClient } from "./quick-analysis-client";

/** Result of reading the pasted text with the chosen separator. */
type Parsed = { points: ChartPoint[]; error?: undefined } | { points?: undefined; error: string };

/** Where the current data came from, shown next to the point count. */
type DataSource = "clipboard" | "paste";

function parse(text: string, separator: SeparatorType): Parsed {
  try {
    const points = parseValidPoints(text, separator);
    return points.length ? { points } : { error: "Não há números nos dados colados." };
  } catch (error) {
    if (error instanceof DataValidationError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Não foi possível ler os dados." };
  }
}

function isTextTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

const badge =
  "rounded-full border border-border bg-white px-2 py-0.5 text-[10.5px] leading-none font-medium tabular-nums";
const keycap =
  "rounded border border-b-2 border-border bg-background px-1.5 font-sans text-[10.5px] font-semibold text-muted-foreground";

/**
 * Renders the quick analysis panel. It reads the clipboard each time the window is shown (when
 * no data was entered yet), validates the equation and the points with the same rules as the
 * analysis screen and submits them through the native core.
 *
 * Keyboard: Cmd/Ctrl+Enter submits, Esc hides the window, Cmd/Ctrl+V outside the equation and
 * Cmd/Ctrl+B paste the data. Pasting several lines into the equation also takes them as data.
 *
 * @returns The rendered window content.
 */
export function QuickAnalysisWindow() {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const modifier = isMac ? "⌘" : "Ctrl";
  const shortcutKeys = isMac ? ["⌃", "⌘", "B"] : ["Ctrl", "Win", "B"];
  const equationId = useId();
  const equationErrorId = useId();
  const dataTitleId = useId();
  const equationInput = useRef<HTMLInputElement>(null);

  const [equation, setEquation] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [separator, setSeparator] = useState<SeparatorType>("auto");
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [entrance, setEntrance] = useState(0);

  const parsed = useMemo(() => (text === null ? null : parse(text, separator)), [text, separator]);
  const points = parsed?.points ?? null;
  const hasEquation = equation.trim() !== "";
  const equationError = hasEquation ? validateFitConfig({ ...defaultFitConfig, equation }) : null;
  const parameters = hasEquation && !equationError ? resolveFitParameters("", equation) : null;
  const dataMissing = triedSubmit && !points && text === null;

  const loadText = useCallback((value: string, from: DataSource) => {
    setText(value);
    setSource(from);
    setClipboardError(null);
    setSubmitError(null);
  }, []);

  /**
   * Reads the clipboard into the data. A silent read (on show) only accepts text that parses
   * into at least two points, so an unrelated clipboard never replaces the empty state.
   */
  const pasteFromClipboard = useCallback(
    async (silent: boolean) => {
      try {
        const value = await readClipboardText();
        if (silent && (parse(value, "auto").points?.length ?? 0) < 2) return;
        if (silent) setSeparator("auto");
        loadText(value, "clipboard");
      } catch (error) {
        if (silent) return;
        setClipboardError(
          error instanceof ClipboardReadError
            ? error.message
            : "Não foi possível ler a área de transferência.",
        );
      }
    },
    [loadText],
  );

  const dismiss = useCallback(() => {
    if (!isTauri()) return;
    void quickAnalysisClient.dismiss().catch(console.error);
  }, []);

  const submit = useCallback(async () => {
    setTriedSubmit(true);
    if (submitting || equationError || !points) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await quickAnalysisClient.submit({ equation: equation.trim(), points });
      setText(null);
      setSource(null);
      setSeparator("auto");
      setTriedSubmit(false);
    } catch (error) {
      setSubmitError(String(error));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, equation, equationError, points]);

  // Keyboard handling reads the latest state through a ref, so the listener is added once.
  const handleKey = useRef<(event: KeyboardEvent) => void>(() => {});
  useLayoutEffect(() => {
    handleKey.current = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      const shortcut = getClipboardShortcut(event, isMac);
      const primary = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      const paste =
        primary &&
        !event.altKey &&
        !event.shiftKey &&
        event.code === "KeyV" &&
        !isTextTarget(event.target);
      if (shortcut?.kind === "fit") {
        event.preventDefault();
        void submit();
      } else if (shortcut?.kind === "create" || paste) {
        event.preventDefault();
        void pasteFromClipboard(false);
      }
    };
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKey.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Each time the native core shows the window: replay the entrance, focus and read the clipboard.
  const textRef = useRef(text);
  useLayoutEffect(() => {
    textRef.current = text;
  }, [text]);
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    const listener = getCurrentWindow().listen(QUICK_SHOWN_EVENT, () => {
      if (!active) return;
      setEntrance((value) => value + 1);
      setSubmitError(null);
      equationInput.current?.focus();
      if (textRef.current === null) void pasteFromClipboard(true);
    });
    return () => {
      active = false;
      void listener.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [pasteFromClipboard]);

  /** Takes multi-line text pasted into the equation as data instead. */
  function handleEquationPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!/\r?\n/.test(pasted.trim()) || !parse(pasted, separator).points) return;
    event.preventDefault();
    loadText(pasted, "paste");
  }

  return (
    <div
      key={entrance}
      className="quick-enter flex h-dvh flex-col overflow-hidden border border-[#c9d1c8] bg-background text-foreground"
    >
      <header
        data-tauri-drag-region
        className="flex h-12 shrink-0 select-none items-center gap-2.5 border-b border-border bg-white pl-4 pr-2.5"
      >
        <BrandMark size={20} />
        <span data-tauri-drag-region className="text-[15px] font-extrabold tracking-[-.06em]">
          ATUS<span className="text-brand-coral">.</span>
        </span>
        <span aria-hidden="true" className="h-4 w-px bg-border" />
        <h1 data-tauri-drag-region className="text-[13px] font-semibold">
          Análise rápida
        </h1>
        <span data-tauri-drag-region className="flex-1 self-stretch" />
        <span className="flex gap-0.5" aria-label={`Atalho: ${shortcutKeys.join(" ")}`}>
          {shortcutKeys.map((key) => (
            <kbd key={key} aria-hidden="true" className={keycap}>
              {key}
            </kbd>
          ))}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar análise rápida"
          onClick={dismiss}
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 pt-3.5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={equationId} className="text-[12px] font-semibold">
              Função de ajuste <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <span className="truncate text-[11px] text-muted-foreground">
              Use x como variável; os outros nomes viram parâmetros.
            </span>
          </div>
          <EquationField
            id={equationId}
            label="Função de ajuste"
            size="large"
            value={equation}
            onChange={(value) => {
              setEquation(value);
              setSubmitError(null);
            }}
            inputRef={equationInput}
            invalid={Boolean(equationError)}
            describedBy={equationError ? equationErrorId : undefined}
            autoFocus
            onPaste={handleEquationPaste}
          />
          <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {equationError ? (
              <p id={equationErrorId} role="alert" className="font-medium text-[#a43d35]">
                {equationError}
              </p>
            ) : parameters?.ok && parameters.parameters.length > 0 ? (
              <>
                <span>Parâmetros</span>
                {parameters.parameters.map((parameter, index) => (
                  <span
                    key={parameter.name}
                    className="quick-point inline-flex items-center gap-1 rounded-md border border-border bg-white px-1.5 py-px font-mono text-[11.5px] font-semibold text-foreground"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    {parameter.name}
                    <span className="rounded bg-brand-coral/15 px-1 font-sans text-[9.5px] font-medium">
                      livre
                    </span>
                  </span>
                ))}
                <span className="ml-1">começam em 1; ajuste depois no ATUS.</span>
              </>
            ) : !hasEquation ? (
              <span>Sem função, o ATUS abre só com os dados e você ajusta depois.</span>
            ) : null}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
          <section aria-labelledby={dataTitleId} className="flex min-h-0 flex-col gap-1.5">
            <div className="flex h-6 items-center gap-1.5">
              <h2 id={dataTitleId} className="text-[12px] font-semibold">
                Dados
              </h2>
              {points && (
                <span className={badge}>
                  {points.length} {points.length === 1 ? "ponto" : "pontos"}
                </span>
              )}
              {points && source === "clipboard" && (
                <span className={`${badge} text-muted-foreground`}>do clipboard</span>
              )}
              <span className="flex-1" />
              {text !== null && (
                <>
                  <SeparatorSelect
                    label="Separador dos dados"
                    value={separator}
                    onChange={setSeparator}
                    className="h-6 rounded border border-border bg-white px-1 text-[11px] text-[#35443a]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Limpar dados"
                    onClick={() => {
                      setText(null);
                      setSource(null);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </>
              )}
            </div>
            {points ? (
              <DataPointsTable
                key={text}
                points={points}
                containerClassName="min-h-0 flex-1 rounded-lg border border-border bg-white"
              />
            ) : (
              <div
                className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-white px-6 text-center ${parsed?.error || dataMissing ? "border-[#c13a32]" : "border-[#c8d0c8]"}`}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ClipboardPaste size={17} aria-hidden="true" />
                </span>
                {parsed?.error ? (
                  <>
                    <p role="alert" className="text-[12px] font-semibold text-[#a43d35]">
                      {parsed.error}
                    </p>
                    <p className="text-[11.5px] leading-5 text-muted-foreground">
                      Escolha outro separador acima ou cole de novo.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-semibold">Cole os dados</p>
                    <p className="max-w-[34ch] text-[11.5px] leading-5 text-muted-foreground">
                      Copie as colunas x, y e, se houver, σy e σx de uma planilha e aperte{" "}
                      <kbd className="font-sans font-semibold">{modifier} V</kbd>.
                    </p>
                  </>
                )}
                {(clipboardError || dataMissing) && (
                  <p role="alert" className="text-[11.5px] font-medium text-[#a43d35]">
                    {clipboardError ?? "Cole ao menos um ponto."}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 bg-white"
                  onClick={() => void pasteFromClipboard(false)}
                >
                  Colar do clipboard
                </Button>
              </div>
            )}
          </section>

          <section aria-label="Prévia dos pontos" className="flex min-h-0 flex-col gap-1.5">
            <div className="flex h-6 items-center">
              <h2 className="text-[12px] font-semibold">Prévia</h2>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-white">
              {points ? (
                <PointsPreview
                  points={points}
                  label={`Prévia de ${points.length} pontos colados`}
                />
              ) : (
                <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[11.5px] text-muted-foreground">
                  Os pontos aparecem aqui assim que os dados forem colados.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="flex h-14 shrink-0 items-center gap-3 border-t border-border bg-white pl-4 pr-3">
        {submitError ? (
          <p
            role="alert"
            title={submitError}
            className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-destructive"
          >
            {submitError}
          </p>
        ) : (
          <p className="flex min-w-0 flex-1 items-center gap-3 text-[11.5px] text-muted-foreground">
            <span>
              <kbd className={keycap}>{modifier} V</kbd> cola os dados
            </span>
            <span>
              <kbd className={keycap}>Esc</kbd> fecha
            </span>
          </p>
        )}
        <Button type="button" onClick={() => void submit()} disabled={submitting} className="h-9">
          <Activity aria-hidden="true" />
          {submitting ? "Abrindo o ATUS…" : hasEquation ? "Ajustar no ATUS" : "Abrir no ATUS"}
          <kbd className="font-sans text-[10.5px] font-medium opacity-75">{modifier} ↵</kbd>
        </Button>
      </footer>
    </div>
  );
}
