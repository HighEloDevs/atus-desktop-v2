import type { ChartPoint as DataPoint } from "@/components/chart/Chart";
export type SeparatorType = "auto" | "," | ";" | "\t" | " ";
type ParseOptions = { separator: SeparatorType };
import { detectDelimiter, splitLine } from "./detect-delimiter";
import { parseLocaleNumber } from "./parse-locale-number";

type ParsedLine = { lineIndex: number; parts: string[] };

function collectNumericLines(content: string, effectiveSeparator: string): ParsedLine[] {
  const lines = content.trim().split("\n");
  const numericLines: ParsedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (!/\d/.test(line)) {
      continue;
    }

    const parts = splitLine(line, effectiveSeparator);

    if (parts.some((part) => part === "")) {
      throw new Error(`Erro na linha ${i + 1}: há uma coluna vazia.`);
    }

    if (parts.length > 4) {
      throw new Error(`Erro na linha ${i + 1}: O formato do arquivo excede 4 colunas de dados.`);
    }

    if (parts.length >= 1) {
      numericLines.push({ lineIndex: i, parts });
    }
  }

  return numericLines;
}

function resolveParseMode(numericLines: ParsedLine[]): "single-column" | "multi-column" {
  if (numericLines.length === 0) {
    return "multi-column";
  }

  const hasSingle = numericLines.some((line) => line.parts.length === 1);
  const hasMulti = numericLines.some((line) => line.parts.length >= 2);

  if (hasSingle && hasMulti) {
    throw new Error(
      "Formato misto detectado: algumas linhas têm uma coluna e outras têm duas ou mais. Use apenas valores y (uma coluna) ou o par x, y.",
    );
  }

  if (hasSingle) {
    return "single-column";
  }

  return "multi-column";
}

function parseSingleColumnLines(numericLines: ParsedLine[]): DataPoint[] {
  const data: DataPoint[] = [];
  let isFirstDataLine = true;

  for (const { lineIndex, parts } of numericLines) {
    const yVal = parts[0];
    const y = parseLocaleNumber(yVal);

    if (isFirstDataLine && isNaN(y)) {
      isFirstDataLine = false;
      continue;
    }

    if (isNaN(y)) {
      throw new Error(`Erro na linha ${lineIndex + 1}: O valor '${yVal}' não é um número válido.`);
    }

    isFirstDataLine = false;
    data.push({ x: data.length, y, sx: 0, sy: 0 });
  }

  return data;
}

function parseMultiColumnLines(numericLines: ParsedLine[]): DataPoint[] {
  const data: DataPoint[] = [];
  let isFirstDataLine = true;

  for (const { lineIndex, parts } of numericLines) {
    if (parts.length < 2) continue;

    const xVal = parts[0];
    const yVal = parts[1];

    const x = parseLocaleNumber(xVal);
    const y = parseLocaleNumber(yVal);

    if (isFirstDataLine && (isNaN(x) || isNaN(y))) {
      isFirstDataLine = false;
      continue;
    }

    if (isNaN(x)) {
      throw new Error(`Erro na linha ${lineIndex + 1}: O valor '${xVal}' não é um número válido.`);
    }
    if (isNaN(y)) {
      throw new Error(`Erro na linha ${lineIndex + 1}: O valor '${yVal}' não é um número válido.`);
    }

    isFirstDataLine = false;

    let sx = 0;
    let sy = 0;

    if (parts.length > 2) {
      const syVal = parts[2];
      sy = parseLocaleNumber(syVal);
      if (isNaN(sy)) {
        throw new Error(
          `Erro na linha ${lineIndex + 1}: O valor '${syVal}' (incerteza y) não é um número válido.`,
        );
      }
    }

    if (parts.length > 3) {
      const sxVal = parts[3];
      sx = parseLocaleNumber(sxVal);
      if (isNaN(sx)) {
        throw new Error(
          `Erro na linha ${lineIndex + 1}: O valor '${sxVal}' (incerteza x) não é um número válido.`,
        );
      }
    }

    data.push({ x, y, sx, sy });
  }

  return data;
}

export class TextDataParser {
  parse(content: string, options: ParseOptions): DataPoint[] {
    const { separator } = options;
    const effectiveSeparator = separator === "auto" ? detectDelimiter(content) : separator;
    const numericLines = collectNumericLines(content, effectiveSeparator);
    const mode = resolveParseMode(numericLines);

    const data =
      mode === "single-column"
        ? parseSingleColumnLines(numericLines)
        : parseMultiColumnLines(numericLines);

    if (data.length === 0) {
      throw new Error(
        "Nenhum dado válido encontrado. Verifique o separador e o formato (x, y) ou uma coluna de valores y.",
      );
    }

    return data;
  }
}

export const textParser = new TextDataParser();
