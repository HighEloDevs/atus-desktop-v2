/**
 * @module
 * Simulated spreadsheet where a lesson asks the student to select and copy the data.
 */

import { useEffect, useRef, useState } from "react";
import { notify } from "@/lib/notify";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bounds,
  cellName,
  cellText,
  contains,
  coversData,
  rangeToTsv,
  type SheetRange,
} from "./sheet-range";

/** Empty rows drawn below the data, as in a real sheet. */
const BLANK_ROWS = 4;
/** One empty column after the data. */
const COLUMN_COUNT = 4;

/**
 * Spreadsheet window with the lesson data.
 *
 * Selecting cells puts their text in a hidden, selected text area, so the system copy
 * (⌘C or Ctrl+C, including the macOS Edit menu) has a real selection to copy. The `copy`
 * event then writes the tab-separated text, as a spreadsheet does, and reports whether
 * the selection holds all the data.
 *
 * @param props.fileName - Name shown in the window title.
 * @param props.header - Column titles.
 * @param props.rows - Data rows.
 * @param props.modifier - "⌘" or "Ctrl", for the hints.
 * @param props.onCopied - Called when the complete data range is copied.
 */
export function MockSpreadsheet({
  fileName,
  header,
  rows,
  modifier,
  onCopied,
}: {
  fileName: string;
  header: string[];
  rows: number[][];
  modifier: string;
  onCopied: () => void;
}) {
  const [range, setRange] = useState<SheetRange | null>(null);
  const [copied, setCopied] = useState<SheetRange | null>(null);
  const dragging = useRef(false);
  const clipboard = useRef<HTMLTextAreaElement>(null);
  const columns = header.length;
  const text = range ? rangeToTsv(header, rows, range) : "";

  // Keeps a real text selection that matches the cells, so the system copy is enabled.
  useEffect(() => {
    const area = clipboard.current;
    if (!area || !range) return;
    area.focus({ preventScroll: true });
    area.select();
  }, [range]);

  useEffect(() => {
    function stop() {
      dragging.current = false;
    }
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      if (!range) return;
      event.clipboardData?.setData("text/plain", rangeToTsv(header, rows, range));
      event.preventDefault();
      setCopied(range);
      if (coversData(range, rows.length, columns)) onCopied();
      else
        notify.warning("Faltam dados na seleção", {
          description: `Selecione de A2 até ${cellName(rows.length, columns - 1)}, com as três colunas.`,
          id: "lesson-sheet-copy",
        });
    }
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [range, header, rows, columns, onCopied]);

  function select(next: SheetRange) {
    setRange(next);
    setCopied(null);
  }

  const status = range
    ? `${copied ? "Copiado" : "Selecionado"}: ${cellName(bounds(range).top, bounds(range).left)}:${cellName(bounds(range).bottom, bounds(range).right)}`
    : `Arraste para selecionar e copie com ${modifier}+C`;
  const allRows = rows.length + 1 + BLANK_ROWS;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-[#20272c]">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-[#eef0ec] px-4 text-[12px]">
        <span className="font-semibold">{fileName}</span>
        <span className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Planilha simulada
        </span>
        <span role="status" className="ml-auto text-muted-foreground">
          {status}
        </span>
      </div>
      <div data-tour="lesson-sheet" className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-4 font-mono text-[12px] text-muted-foreground">
          <span className="w-20 border-r border-border">
            {range ? cellName(bounds(range).top, bounds(range).left) : "A1"}
          </span>
          <span className="truncate">{range ? text.split("\n")[0].split("\t")[0] : header[0]}</span>
          <button
            type="button"
            onClick={() => select({ r0: 0, c0: 0, r1: rows.length, c1: columns - 1 })}
            className="ml-auto rounded border border-border bg-white px-2 py-1 font-sans text-[11px] font-medium text-foreground hover:bg-muted"
          >
            Selecionar dados
          </button>
        </div>
        <textarea
          ref={clipboard}
          readOnly
          aria-label="Conteúdo selecionado da planilha"
          value={text}
          className="pointer-events-none absolute h-px w-px opacity-0"
          tabIndex={-1}
        />
        <div className="min-h-0 flex-1 overflow-auto select-none">
          <Table className="w-auto border-collapse text-[12px] tabular-nums">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="h-7 w-10 border border-border bg-[#f3f4f1]" />
                {Array.from({ length: COLUMN_COUNT }, (_, c) => (
                  <TableHead
                    key={c}
                    scope="col"
                    onMouseDown={(event) =>
                      select({
                        r0: 0,
                        r1: rows.length,
                        c0: event.shiftKey && range ? range.c0 : c,
                        c1: c,
                      })
                    }
                    className="h-7 w-28 cursor-pointer border border-border bg-[#f3f4f1] text-center text-[11px] font-medium text-muted-foreground"
                  >
                    {String.fromCharCode(65 + c)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: allRows }, (_, r) => (
                <TableRow key={r} className="border-border hover:bg-transparent">
                  <TableHead
                    scope="row"
                    className="h-7 border border-border bg-[#f3f4f1] text-center text-[11px] font-medium text-muted-foreground"
                  >
                    {r + 1}
                  </TableHead>
                  {Array.from({ length: COLUMN_COUNT }, (_, c) => {
                    const value = r === 0 ? header[c] : rows[r - 1]?.[c];
                    const selected = contains(range, r, c);
                    return (
                      <TableCell
                        key={c}
                        aria-selected={selected}
                        onMouseDown={(event) => {
                          dragging.current = true;
                          select(
                            event.shiftKey && range
                              ? { ...range, r1: r, c1: c }
                              : { r0: r, c0: c, r1: r, c1: c },
                          );
                        }}
                        onMouseEnter={() => {
                          if (dragging.current && range) select({ ...range, r1: r, c1: c });
                        }}
                        className={`h-7 w-28 cursor-cell border border-border px-2 ${r === 0 ? "text-left font-semibold" : "text-right font-mono"} ${selected ? "bg-[#e3e7ff]" : ""} ${contains(copied, r, c) ? "outline-dashed outline-1 -outline-offset-2 outline-foreground" : ""}`}
                      >
                        {value === undefined
                          ? ""
                          : typeof value === "number"
                            ? cellText(value)
                            : value}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
